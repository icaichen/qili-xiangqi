import { readFile, writeFile } from "node:fs/promises";
const url=new URL("./app.js",import.meta.url); let a=await readFile(url,"utf8");
const old='const reviewDropzoneElement = document.querySelector("#reviewDropzone");';
const add=`const reviewDropzoneElement = document.querySelector("#reviewDropzone");
const platformViews = {
  home: document.querySelector("#homeView"), play: document.querySelector("#playView"),
  train: document.querySelector("#trainView"), learn: document.querySelector("#learnView"),
  review: document.querySelector("#reviewDropzone"), analysis: document.querySelector("#analysisView"),
  profile: document.querySelector("#profileView"),
};
const quickPlayButtonElement = document.querySelector("#quickPlayButton");
const learnNotationButtonElement = document.querySelector("#learnNotationButton");
const curriculumDetailElement = document.querySelector("#curriculumDetail");`;
if(!a.includes(old)) throw new Error("binding marker missing"); a=a.replace(old,add); await writeFile(url,a); console.log("platform bindings added");