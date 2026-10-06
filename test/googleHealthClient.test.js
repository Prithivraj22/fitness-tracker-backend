const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');

const { buildAuthorizationUrl, dailyRollUp, normalizeDashboardData } = require('../googleHealthClient');

test('Google Health authorization requests offline read-only access', () => {
    process.env.GOOGLE_HEALTH_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_HEALTH_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_HEALTH_REDIRECT_URI = 'https://api.example.com/auth/google-health/callback';

    const url = new URL(buildAuthorizationUrl('signed-state'));

    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('prompt'), 'consent');
    assert.deepEqual(url.searchParams.get('scope').split(' '), [
        'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
        'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
    ]);
    assert.equal(url.searchParams.get('state'), 'signed-state');
});

test('Google Health data is normalized to the existing dashboard contract', () => {
    const result = normalizeDashboardData({
        steps: [
            { steps: { count: '1200' } },
            { steps: { count: '300' } },
        ],
        distance: [{ distance: { meters: 2500 } }],
        activeEnergy: [{ activeEnergyBurned: { kcal: 240.4 } }],
        basalEnergy: [{ basalEnergyBurned: { kcal: 1200.2 } }],
        heartRate: [{
            heartRate: {
                beatsPerMinute: '72',
                sampleTime: { civilTime: { hour: 9, minute: 5, second: 2 } },
            },
        }],
        exercise: [{
            exercise: {
                displayName: 'Walking',
                activeDuration: '600s',
                metricsSummary: {
                    caloriesKcal: 50,
                    steps: '700',
                    distanceMillimeters: 520000,
                },
            },
        }],
    });

    assert.equal(result.dailySummary.steps, 1500);
    assert.equal(result.dailySummary.caloriesBurned, 1441);
    assert.deepEqual(result.dailySummary.distance, [{ activity: 'total', distance: 2.5 }]);
    assert.equal(result.dailySummary.activeMinutes, 10);
    assert.deepEqual(result.heartRateData, [{ time: '09:05:02', bpm: 72 }]);
    assert.deepEqual(result.activityLog[0], {
        activityName: 'Walking',
        duration: 600000,
        calories: 50,
        steps: 700,
        distance: 0.52,
    });
});

test('reconciled daily rollups take precedence over raw source totals', () => {
    const result = normalizeDashboardData({
        steps: [{ steps: { count: '9999' } }],
        distance: [{ distance: { meters: 9999 } }],
        activeEnergy: [{ activeEnergyBurned: { kcal: 9999 } }],
        basalEnergy: [],
        stepsRollup: { steps: { countSum: '4321' } },
        distanceRollup: { distance: { millimetersSum: '3210000' } },
        caloriesRollup: { totalCalories: { kcalSum: 1789.4 } },
        heartRate: [],
        exercise: [],
    });

    assert.equal(result.dailySummary.steps, 4321);
    assert.equal(result.dailySummary.caloriesBurned, 1789);
    assert.deepEqual(result.dailySummary.distance, [{ activity: 'total', distance: 3.21 }]);
});

test('Google Health normalizer tolerates missing optional data', () => {
    const result = normalizeDashboardData({
        steps: [],
        distance: [],
        activeEnergy: [],
        basalEnergy: [],
        heartRate: [],
        exercise: [],
    });

    assert.equal(result.dailySummary.steps, 0);
    assert.equal(result.dailySummary.caloriesBurned, 0);
    assert.deepEqual(result.heartRateData, []);
    assert.deepEqual(result.activityLog, []);
});

test('daily rollups send Google Health civil date-time boundaries', async () => {
    const originalPost = axios.post;
    let requestBody;
    axios.post = async (_url, body) => {
        requestBody = body;
        return { data: { rollupDataPoints: [] } };
    };

    try {
        await dailyRollUp('access-token', 'steps', '2026-10-06');
    } finally {
        axios.post = originalPost;
    }

    assert.deepEqual(requestBody.range, {
        start: { date: { year: 2026, month: 10, day: 6 }, time: {} },
        end: { date: { year: 2026, month: 10, day: 7 }, time: {} },
    });
});
