This command uses the following `sb.Config` variables:

- `TTS_ENABLED` 
    - `{boolean}` 
    - Determines if the TTS system is enabled or not. 
    - If `false`, this command will refuse all executions.
- `TTS_MULTIPLE_ENABLED`
    - `{boolean}`
  - Determines if the more than one TTS can be played at the same time.
- `TTS_VOLUME`
    - `{number}`
    - Determines the volume a given TTS text will be played at
    - Uses range `[0.0, 8.0]` - with most reasonable values being `1.0` or less.

