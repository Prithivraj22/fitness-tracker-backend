const axios = require('axios');

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE_URL = 'https://health.googleapis.com/v4';
const READ_SCOPES = [
    'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
    'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
];

const getOAuthConfig = () => {
    const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_HEALTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Google Health OAuth is not configured.');
    }
    return { clientId, clientSecret, redirectUri };
};

const buildAuthorizationUrl = (state) => {
    const { clientId, redirectUri } = getOAuthConfig();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        scope: READ_SCOPES.join(' '),
        state,
    });
    return `${AUTHORIZATION_URL}?${params.toString()}`;
};

const exchangeAuthorizationCode = async (code) => {
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    const form = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
    });
    const response = await axios.post(TOKEN_URL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
    });
    return response.data;
};

const refreshAccessToken = async (refreshToken) => {
    const { clientId, clientSecret } = getOAuthConfig();
    const form = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    });
    const response = await axios.post(TOKEN_URL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
    });
    return response.data;
};

const revokeToken = async (token) => {
    const form = new URLSearchParams({ token });
    await axios.post('https://oauth2.googleapis.com/revoke', form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
    });
};

const authHeaders = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

const getIdentity = async (accessToken) => {
    const response = await axios.get(`${API_BASE_URL}/users/me/identity`, {
        headers: authHeaders(accessToken),
        timeout: 10000,
    });
    return response.data;
};

const listDataPoints = async (accessToken, dataType, filter, maxPages = 10) => {
    const dataPoints = [];
    let pageToken;
    for (let page = 0; page < maxPages; page += 1) {
        const response = await axios.get(
            `${API_BASE_URL}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints`,
            {
                headers: authHeaders(accessToken),
                params: {
                    filter,
                    pageSize: 1000,
                    ...(pageToken ? { pageToken } : {}),
                },
                timeout: 10000,
            }
        );
        dataPoints.push(...(response.data.dataPoints || []));
        pageToken = response.data.nextPageToken;
        if (!pageToken) break;
    }
    return dataPoints;
};

const reconcileDataPoints = async (accessToken, dataType, filter, maxPages = 10) => {
    const dataPoints = [];
    let pageToken;
    for (let page = 0; page < maxPages; page += 1) {
        const response = await axios.get(
            `${API_BASE_URL}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints:reconcile`,
            {
                headers: authHeaders(accessToken),
                params: {
                    filter,
                    pageSize: 1000,
                    ...(pageToken ? { pageToken } : {}),
                },
                timeout: 10000,
            }
        );
        dataPoints.push(...(response.data.dataPoints || []));
        pageToken = response.data.nextPageToken;
        if (!pageToken) break;
    }
    return dataPoints;
};

const civilDate = (date) => {
    const [year, month, day] = date.split('-').map(Number);
    return { year, month, day };
};

const civilDateTime = (date) => ({
    date: civilDate(date),
    time: {},
});

const dailyRollUp = async (accessToken, dataType, date) => {
    const response = await axios.post(
        `${API_BASE_URL}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints:dailyRollUp`,
        {
            range: {
                start: civilDateTime(date),
                end: civilDateTime(nextDate(date)),
            },
            windowSizeDays: 1,
            pageSize: 1,
        },
        {
            headers: authHeaders(accessToken),
            timeout: 10000,
        }
    );
    return response.data.rollupDataPoints?.[0] || {};
};

const nextDate = (date) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed.toISOString().slice(0, 10);
};

const civilIntervalFilter = (field, date) => (
    `${field} >= "${date}" AND ${field} < "${nextDate(date)}"`
);

const sum = (items, getter) => items.reduce((total, item) => {
    const value = Number(getter(item));
    return total + (Number.isFinite(value) ? value : 0);
}, 0);

const durationToMilliseconds = (duration) => {
    const seconds = Number(String(duration || '').replace(/s$/, ''));
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
};

const civilTimeLabel = (sampleTime) => {
    const civil = sampleTime?.civilTime;
    if (civil) {
        return [civil.hour, civil.minute, civil.second]
            .map((value) => String(value || 0).padStart(2, '0'))
            .join(':');
    }
    const physical = sampleTime?.physicalTime;
    if (!physical) return '';
    const parsed = new Date(physical);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 19);
};

const metricNumber = (summary, keys) => {
    for (const key of keys) {
        const metric = summary?.[key];
        if (metric === undefined || metric === null) continue;
        if (Number.isFinite(Number(metric))) return Number(metric);
        for (const nestedKey of ['value', 'count', 'kcal', 'meters', 'kilometers']) {
            if (Number.isFinite(Number(metric[nestedKey]))) return Number(metric[nestedKey]);
        }
    }
    return 0;
};

const normalizeDashboardData = ({
    steps = [],
    distance = [],
    activeEnergy = [],
    basalEnergy = [],
    stepsRollup,
    distanceRollup,
    caloriesRollup,
    heartRate = [],
    exercise = [],
}) => {
    const rolledUpSteps = Number(stepsRollup?.steps?.countSum);
    const rolledUpDistanceMillimeters = Number(distanceRollup?.distance?.millimetersSum);
    const rolledUpCalories = Number(caloriesRollup?.totalCalories?.kcalSum);
    const stepCount = Number.isFinite(rolledUpSteps)
        ? rolledUpSteps
        : sum(steps, (point) => point.steps?.count);
    const distanceMeters = Number.isFinite(rolledUpDistanceMillimeters)
        ? rolledUpDistanceMillimeters / 1000
        : sum(distance, (point) => (
            point.distance?.meters ??
            (Number(point.distance?.millimeters) / 1000)
        ));
    const caloriesBurned = Number.isFinite(rolledUpCalories)
        ? rolledUpCalories
        : sum(activeEnergy, (point) => point.activeEnergyBurned?.kcal)
            + sum(basalEnergy, (point) => point.basalEnergyBurned?.kcal);
    const heartRateData = heartRate
        .map((point) => ({
            time: civilTimeLabel(point.heartRate?.sampleTime),
            bpm: Number(point.heartRate?.beatsPerMinute),
        }))
        .filter((entry) => entry.time && Number.isFinite(entry.bpm));
    const activityLog = exercise.map((point) => {
        const activity = point.exercise || {};
        const summary = activity.metricsSummary || {};
        return {
            activityName: activity.displayName || activity.exerciseType || 'Exercise',
            duration: durationToMilliseconds(activity.activeDuration),
            calories: metricNumber(summary, ['caloriesKcal', 'calories', 'energy', 'activeEnergyBurned']),
            steps: metricNumber(summary, ['steps', 'stepCount']),
            distance: summary.distanceMillimeters
                ? Number(summary.distanceMillimeters) / 1000000
                : metricNumber(summary, ['distance']),
        };
    });
    const activeMinutes = Math.round(sum(
        exercise,
        (point) => durationToMilliseconds(point.exercise?.activeDuration) / 60000
    ));

    return {
        dailySummary: {
            steps: stepCount,
            distance: [{ activity: 'total', distance: distanceMeters / 1000 }],
            elevation: 0,
            floors: 0,
            caloriesBurned: Math.round(caloriesBurned),
            activeMinutes,
            activityGoals: {},
        },
        lifetimeStats: {
            steps: 0,
            distance: 0,
            caloriesBurned: 0,
        },
        activityLog,
        heartRateData,
    };
};

const fetchDashboardData = async (accessToken, date) => {
    const [stepsRollup, distanceRollup, caloriesRollup] = await Promise.all([
        dailyRollUp(accessToken, 'steps', date),
        dailyRollUp(accessToken, 'distance', date),
        dailyRollUp(accessToken, 'total-calories', date),
    ]);
    const optionalRequests = [
        reconcileDataPoints(accessToken, 'heart-rate', civilIntervalFilter('heart_rate.sample_time.civil_time', date)),
        reconcileDataPoints(accessToken, 'exercise', civilIntervalFilter('exercise.interval.civil_start_time', date)),
    ];
    const [heartRateResult, exerciseResult] = await Promise.allSettled(optionalRequests);
    return normalizeDashboardData({
        stepsRollup,
        distanceRollup,
        caloriesRollup,
        heartRate: heartRateResult.status === 'fulfilled' ? heartRateResult.value : [],
        exercise: exerciseResult.status === 'fulfilled' ? exerciseResult.value : [],
    });
};

module.exports = {
    READ_SCOPES,
    buildAuthorizationUrl,
    dailyRollUp,
    exchangeAuthorizationCode,
    fetchDashboardData,
    getIdentity,
    listDataPoints,
    normalizeDashboardData,
    reconcileDataPoints,
    refreshAccessToken,
    revokeToken,
};
