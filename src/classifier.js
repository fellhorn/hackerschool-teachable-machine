// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import "@babel/polyfill";
import * as mobilenetModule from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as _ from "lodash";
import db from './database';

// K value for KNN
const TOPK = 10;
let knn = null;
let mobilenet = null;

let labels = [];

async function start() {
  if (!await mobilenet) {
    knn = knnClassifier.create();
    mobilenet = mobilenetModule.load();
    mobilenet = await mobilenet;
    console.log("Loaded mobilnet");
  }
}

function getInsertLabelIndex(label) {
  const index = labels.findIndex((str) => str === label);
  if (index == -1) {
    labels.push(label);
    return labels.length - 1;
  } else {
    return index;
  }
}

/**
 *
 *
 * @param {*} imageSource the image
 * @param {string} label if != "" train  the classifier with this label
 */
async function infer(imageSource, label = "") {
  let result = '';
  // Get image data from video element
  const image = tf.fromPixels(imageSource);

  let logits;
  // 'conv_preds' is the logits activation of MobileNet.
  const infer = () => mobilenet.infer(image, 'conv_preds');

  
  // Train class if one of the buttons is held down
  if (label) {
    logits = infer();
    const index = getInsertLabelIndex(label);

    // Add current image to classifier
    knn.addExample(logits, index);
  }

  const numClasses = knn.getNumClasses();
  let res = null;
  if (numClasses > 0) {
    // If classes have been added run predict
    logits = infer();
    
    
    // TODO
    // hier bekommt ihr ein objekt, das so ausschaut:
    // classIndex: die index nummer des labels
    // label: das label selbst
    // confidences: ein array wo jede zahl die confidence der jeweiligen klasse
    // angibt
    res = await knn.predictClass(logits, TOPK);


    // das sollt ihr aendern
    result = labels[res.classIndex];
  }


  // Dispose image when done
  image.dispose();
  if (logits != null) {
    logits.dispose();
  }

  return [result, Object.values(res.confidences)];
}

function getLabelsWithCount() {
  const counts = knn.getClassExampleCount();
  return _.map(labels, (label, key) => ({
    label,
    count: counts[key]
  }));
}

function exportClassifier() {
  const dataset = knn.getClassifierDataset();
  var datasetObj = {}
  Object.keys(dataset).forEach((key) => {
    let data = dataset[key].dataSync();
    // use Array.from() so when JSON.stringify() it covert to an array string e.g [0.1,-0.2...] 
    // instead of object e.g {0:"0.1", 1:"-0.2"...}
    datasetObj[key] = Array.from(data);
  });

  const state = {
    dataset: datasetObj,
    labels,
  }

  return state;
}

async function saveClassifierToIndexedDB() {
  const name = window.prompt("Name deines Speicherpunkts:");
  const state = exportClassifier();
  await db.classifiers.put(
    { name, ...state }
  );
}

function listClassifiers() {
  return db.classifiers.orderBy('name').keys();
}

async function loadClassifierFromIndexedDB(id) {
  const state = await db.classifiers.get(id);
  importClassifier(state);
}

function saveClassifierToLocalStorage() {
  const state = exportClassifier();
  localStorage.setItem("model", JSON.stringify(state));
}

function loadClassifierFromLocalStorage() {
  const state = JSON.parse(localStorage.getItem("model"));
  importClassifier(state);
}

function downloadClassifier() {
  const state = exportClassifier();

  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  var dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", "model.json");
  dlAnchorElem.click();
}

function importClassifier(state) {
  labels = state.labels;
  const tensorObj = state.dataset;

  Object.keys(tensorObj).forEach((key) => {
    tensorObj[key] = tf.tensor(tensorObj[key], [tensorObj[key].length / 1000, 1000])
  })
  knn.setClassifierDataset(tensorObj);
}

export {
  labels,
  downloadClassifier,
  infer,
  start,
  getLabelsWithCount,
  importClassifier,
  saveClassifierToLocalStorage,
  loadClassifierFromLocalStorage,
  saveClassifierToIndexedDB,
  loadClassifierFromIndexedDB,
  listClassifiers,
}