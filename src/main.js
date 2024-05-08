import "setimmediate";

import Globals from "../build/Globals-browser.js";

import * as riot from "riot";

import { minidenticon } from "minidenticons";

import WebChatChannel from "./webchat-channel.riot";
import WebChatMessage from "./webchat-message.riot";
import WebChatBlob from "./webchat-blob.riot";
import WebChatReactions from "./webchat-reactions.riot";
import Raw from "./raw.riot";

import App from "./app.riot"

import "./main.css";

riot.register("webchat-channel", WebChatChannel);
riot.register("webchat-message", WebChatMessage);
riot.register("webchat-blob", WebChatBlob);
riot.register("webchat-reactions", WebChatReactions);
riot.register("raw", Raw);

// Need to call minidenticon to activate it.
minidenticon();

riot.component(App)(document.querySelector("#app"), { Globals });
