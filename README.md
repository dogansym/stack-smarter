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

## Prize claim flow

Prize winners see a tracked signup link after unlocking Bronze, Silver or Gold. The link opens Symetri's existing AI campaign form with `utm_source`, `utm_medium`, `utm_campaign` and the prize level in `utm_content`. Winners complete the signup there and show the confirmation to the Symetri team to collect the prize.

## GitHub Pages

The Three.js runtime is vendored in `vendor/`, so the site has no build step or external network dependency. Publish the repository root from **Settings → Pages** and it will run as-is.
