# Backyard Sports Online Server

Lobby server code for Backyard Sports Online

## Using docker-compose to deploy the server locally
Run the following to launch the server and a redis instance for it to use:
```
docker-compose build
docker-compose up server redis
```

In order to use the server along with the [BYOnline session server](https://github.com/Backyard-Sports-Online/session), you'll have to build a session server image and tag it `session-main:latest`. Then, you can launch all three components (server, redis, and session server) with:
```
docker-compose up
```
