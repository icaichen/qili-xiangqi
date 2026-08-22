import { navigation, products, timeControls, type ProductManifest } from "./index";

const adult: ProductManifest = products.qilichess;
const kids: ProductManifest = products.qilichesskids;

if (adult.scheme === kids.scheme || timeControls[1].incrementSeconds !== 2) {
  throw new Error("product-config contract changed unexpectedly");
}

const kidLearnTab = navigation.kids.find((item) => item.id === "learn");
if (kidLearnTab?.label !== "学习") {
  throw new Error("kids learning destination must remain discoverable");
}

if (navigation.adult.map((item) => item.id).join(",") !== "home,play,learn,review,profile") {
  throw new Error("adult navigation must preserve the Home/Play/Learn/Review/Profile IA");
}

if (navigation.kids.map((item) => item.id).join(",") !== "home,play,learn,review,profile" || !kids.features.livePlay) {
  throw new Error("kids app must preserve the complete Qili product navigation");
}
