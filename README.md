# Interoperable browser chat based on OpenOdin

## Usage

>Step out from the platform: Enter The Void

### Firefox

1. **Download** the Datawallet extension from [https://addons.mozilla.org/en-US/firefox/addon/datawallet/](https://addons.mozilla.org/en-US/firefox/addon/datawallet/). Direct download link: https://addons.mozilla.org/firefox/downloads/file/4346369/datawallet-0.4.1.xpi

2. Confirm the addition of the new extension by clicking the **Add** button

![image](https://github.com/user-attachments/assets/74235448-f0e7-4e0e-bd96-a29fc590a2c3)

![image](https://github.com/user-attachments/assets/2d08f5e2-9f9b-41fe-b7c3-92be78ba9290)


3. Access the _Extensions_ by typing _about:addons_ on the address bar or by clicking the **puzzle** icon

![image](https://github.com/user-attachments/assets/4f3361a4-9bb6-40ae-b9a3-6487bdd7e09c)


4. Then **click** _Extensions_ on the left side menu

![image](https://github.com/user-attachments/assets/0ee6cc27-7dcf-4bcf-af06-2f64add2b0ba)


5. Customize your preferences: toggle the extension on and off, _Run in Private Windows_ (incognito mode) if you wish to do so.

![image](https://github.com/user-attachments/assets/cdde3007-9be5-4465-9b1d-e19677a7bd47)



6. Make it easy to access the extension by clicking the **puzzle** icon, then the **Gear** icon right next to _Datawallet_, and select _Pin to Toolbar_

![image](https://github.com/user-attachments/assets/79c60b93-696c-4454-849f-74deb8b913f8)


7. The _Datawallet_ icon will now show in the browser toolbar. Click on it and follow the on-screen instructions: click the **wallet** icon to acess the list of wallets

![image](https://github.com/user-attachments/assets/c723b830-eb0e-4642-aac5-5ad0502f58a5)


8. Press the **New Wallet** button

![image](https://github.com/user-attachments/assets/b7476519-c21f-465b-b5aa-a8319a590ef3)



9. Enter the **Wallet Name** and **Password**, then press **Create**

![image](https://github.com/user-attachments/assets/0e100f05-0afd-44b0-82ec-a20c3f7b50f2)



10. Now back to the wallet list, edit the newly created wallet by clicking the button highlighted on the screenshot below

![image](https://github.com/user-attachments/assets/cceacd31-9aff-49be-bbcd-b0bd045b2577)


11. Next, there will be no keys attached to the newly created wallet. Create a new key pair by pressing the **New** button

![image](https://github.com/user-attachments/assets/46ddf4e7-ebde-4391-b23d-cc209edc009e)


12. The key pair will now be listed as part of the wallet. Press the **Save** button

![image](https://github.com/user-attachments/assets/fc2aa001-33bb-432c-bda5-d3c7ccf8188f)



13. Browse to [https://openodin.com/webchat](https://openodin.com/webchat) then **Press** the _Datawallet_ extension icon

![image](https://github.com/user-attachments/assets/345b9f77-7ea4-43a9-931f-ffd658f5281f)


14. **Press** the _Authenticate_ button

![image](https://github.com/user-attachments/assets/26146c3e-3da6-4a7f-81f4-17fd17b2afd3)



15. **Enter** the _Password_ then *press* _Unlock_

![image](https://github.com/user-attachments/assets/cb40763f-2842-462e-a95b-87812fbc36cb)


16. Proceed with the one-time signing confirmation by **pressing** the _OK_ button

![image](https://github.com/user-attachments/assets/8020265d-98fb-4947-9dba-ef8fe7bbd5c4)



17. All done, you are set!

![image](https://github.com/user-attachments/assets/464d9fb8-7ebb-4f46-987c-89d64a3349d5)



18. Have fun!

![image](https://github.com/user-attachments/assets/77fa7019-252b-4193-bc88-902bef90898d)




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
./serve.sh
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
