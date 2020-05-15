const { Client } = require("./client");
const {
    token,
    gateway
} = require("./constants");

const client = new Client(gateway, token);
