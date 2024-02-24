# Emotes

Since the bot doesn't have a direct way of knowing the available emotes on each specific platform,
the connectors will need to provide this info.

## Providing

All emotes, whether global or channel specific, should be made available via a Redis set, which will then
be updated, invalidated or removed depending on the needs. The connector should manage its sets, the bot will
only be able to read them. Any manipulation of this Redis set should be done by the connector.

Set key: `{connector name}:{global|channel id}:emotes`

## Fetching

Depending on the emote type, the connectors should query them in the following ways:

### Global

Each connector should query all available global (platform and 3rd party) emotes as soon as possible,
and then cache them for a reasonable amount of time. Whenever this cache expires (or a cache reload is requested),
the connector should without delay re-populate this cache.

### Channel-specific

Whenever the connector receives a command to send a message to a specific channel, it should
check whether it has an up-to-date Redis set cache of emotes for that channel. If it doesn't, it should then
query the available platform (and 3rd party, if applicable) emotes for that channel.

This means that potentially, for a single message, there will be a "gap" of emote info. This is acceptable.

## Data structure

```
{
  ID: emote id
  name: emote name/token
  provider: either "(name of platform)" or "(name of 3rd party service)"
  global: boolean
  flags: object of boolean values, e.g. animated, follower, zeroWidth, ...
}
```

Example:

```
{
  ID: "12345",
  name: "PogChamp",
  provider: "twitch",
  global: "true",
  flags: {
    subscriber: false,
    animated: false,
    follower: false,
    zeroWidth: false  
  }
}
```

## Notes

- Supibot needs to know the type of the emote for the purposes of emote filtering (e.g. in the `$randomemote` command)
