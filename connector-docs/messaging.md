# Messages

Supibot and the platform connectors will communicate via Redis streams, in two separate streams.

All naming schemes are from the perspective of the bot, e.g. "incoming message" means a message
that originated from a connector and is meant to be processed by the bot.

## General structure

```json
{
    "platform": "(platform name)",
    "instance": "(specific instance identifier)",
    "type": "(message type)",
    "data": {}
}
```

Here, `instance` refers to any kind of further specialization of a specific instance.
E.g. for IRC, the platform is always "IRC", but since there could be multiple servers,
the `instance` field will distinguish between them. If this is not applicable for the given platform,
the field will simply be `null`.

## Incoming

#### Connector reads a public message in a channel

```json
{
  "platform": "twitch",
  "instance": null,
  "type": "message",
  "data": {
    "private": false,
    "channel": {
      "name": "supinic",
      "id": "31400525"
    },
    "user": {
      "name": "supinic",
      "id": "31400525"
    },
    "message": "this is a test",
    "timestamp": 1234567890
  }
}
```

#### Connector reads a private message

```json
{
  "platform": "twitch",
  "instance": null,
  "type": "message",
  "data": {
    "private": true,
    "channel": null,
    "user": {
      "name": "supinic",
      "id": "31400525"
    },
    "message": "this is a PM test",
    "timestamp": 1234567890
  }
}
```

## Outgoing

#### Bot requests to send a message to a channel

```json
{
  "platform": "twitch",
  "instance": null,
  "type": "message",
  "data": {
    "channel": {
      "name": "supinic",
      "id": "31400525"
    },
    "user": null,
    "message": "this is a public message test"
  }
}
```

#### Bot requests to send a private message

```json
{
  "platform": "twitch",
  "instance": null,
  "type": "message",
  "data": {
    "channel": null,
    "user": {
      "name": "supinic",
      "id": "31400525"
    },
    "message": "this is a private message test"
  }
}
```

#### Bot requests connector to join a channel

```json
{
  "platform": "twitch",
  "instance": null,
  "type": "channel_join",
  "data": {
    "channel": {
      "name": "supinic",
      "id": "31400525"
    }
  }
}
```

#### Bot requests connector to part a channel

```json
{
  "platform": "twitch",
  "instance": null,
  "type": "channel_part",
  "data": {
    "channel": {
      "name": "supinic",
      "id": "31400525"
    }
  }
}
```
