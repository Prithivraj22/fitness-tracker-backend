// Assuming you have the refresh token as a query parameter
const refreshToken = '42579c136b1d0c4c362a345707c65c011f8d375a80b247e7f0a656de7f786ec0';
fetch(`http://localhost:3000/fitbit/activities?refreshToken=${refreshToken}`)
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
