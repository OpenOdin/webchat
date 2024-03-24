# Interoperable browser chat based on OpenOdin

## Configuration files

For development builds the `.json` files are copied from `./conf-dev` into the root directory of the app which is built into `./dist`.

For release builds the appropiate conf file(s) must be place in `./dist` by the outer release process.

The default `JSON` file loaded by the application is `app.json`, to use any other file load the app using the `conf` query parameter, as: `IP:8000/index.html?conf=my-conf.json`.

After building you are free to replace the configuration files in the `./dist` dir as configuration files are dynamically fetched when the application is authenticated with the Datawallet.

## Datawallet browser plugin
To use this webchat you need the [OpenOdin Datawallet browser plugin](httos://github.com/OpenOdin/datawallet).

## Build and run

```sh
npm i
npm run build
serve.sh
```

The application files are placed in `./dist`.

Browse to `<IP:8000>/index.html`.


## Release
```sh
npm i
npm run release
```

The application files are placed in `./dist`.

Place an applicable `app.json` file into `./dist` and the application is ready for release.

If using a prebuilt release make sure to add the `app.json` into the root dir of the app when publishing it.


_Tags_ are inspired by the SemVer.org convention. The version is expected to match the following regular expression:
```
[0-9]+.[0-9]+.[0-9]+
```

Create a new tag from _GitHub_ so that the artifacts get automatically built by _GitHub Action_.  
To do so, draft a new release here: https://github.com/OpenOdin/webchat/releases/new.
