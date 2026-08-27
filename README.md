# STACK SMARTER

A mobile-first Three.js Symetri arcade game created for BIM World Copenhagen.

Read the simulated site wind, compensate for the hanging load and land the gold prize module at floor 12.
The round-based wind monitor, animated skyline turbines and progressive camera pullback make long towers readable without adding extra controls.

## Run locally

Serve this directory with any static web server, for example:

```sh
python -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages

The Three.js runtime is vendored in `vendor/`, so the site has no build step or external network dependency. Publish the repository root from **Settings → Pages** and it will run as-is.
