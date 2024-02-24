# Channels

Supibot will provide the connectors with a Redis set of "persistent" channels to join. 
Connectors should read this set on restart/reconnect and join all channels accordingly.

As another way of manipulating the current channel list, Supibot can send a message to specifically join,
or part a specific channel. Connectors should respect this command and do so. On the connector side,
these commands will not alter the persistent set by default. Supibot can make these changes together, but it is not
required to do so.

The persistent set will be a Redis set with the key 
- `{platform name}:channels`
- `{platform name}:{instance}:channels` if instance is defined.

E.g.:
- `twitch:channels`
- `irc:libera:channels`

### Implicit joining

Since Discord doesn't follow the IRC-like channel system where the client joins channels
as they see fit, and instead has the client join all channels it can by default,
it will not use a persistent channels set.
