# STACK SMARTER

A mobile-first Three.js Symetri arcade game created for BIM World Copenhagen.

Read the simulated site wind, compensate for the hanging load and secure bronze at floor 15, silver at floor 20 and gold at floor 30.
The round-based wind monitor, height-dependent wind exposure, animated skyline turbines and progressive camera pullback make long towers readable without adding extra controls.

## Run locally

Serve this directory with any static web server, for example:

```sh
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Prize claim integration

Prize winners see a name/company/email form with newsletter consent after unlocking Bronze, Silver or Gold. Set `CLAIM_ENDPOINT` near the top of `game.js` to the production CRM or form-handler URL. Until it is configured, the prototype completes the on-screen flow without transmitting or storing personal data.

## GitHub Pages

The Three.js runtime is vendored in `vendor/`, so the site has no build step or external network dependency. Publish the repository root from **Settings → Pages** and it will run as-is.
