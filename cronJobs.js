/*
const cron = require('node-cron');
const { fetchFitbitData } = require('./controller');
const axios = require('axios');


cron.schedule('30 * * * *', async () => {
    console.log('Cron job running to fetch Fitbit data...');

    const accessToken = req.cookies.fitbitAccessToken; 
    const date = moment().format('YYYY-MM-DD'); 

    try {
        const result = await fetchFitbitData(accessToken, date);
        console.log('Fetched Fitbit data:', result);
    } catch (error) {
        console.error('Error fetching Fitbit data in cron job:', error.message);
    }
});
*/
