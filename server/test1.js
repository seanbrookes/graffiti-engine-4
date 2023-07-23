import express from 'express';


/**
 * This is the main backend file for GE
 * I handles fetching, saving, editing, publishing, painting, etc for the local post data
 */












// TODO - this will need to be more dynamic
const PORT = 4441;

const server = express();


server.get('*', (req, res) => {
  res.send('nothing here');
});






server.listen(PORT, () => {
  console.log('Graffiti Engine 4 server is running on port', 4441);
});
