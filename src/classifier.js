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

// Webcam Image size. Must be 227. 
const IMAGE_SIZE = 227;

// K value for KNN
const TOPK = 10;
let knn = null;
let mobilenet = null;

const labels = [];

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
    console.log("training");
    logits = infer();
    const index = getInsertLabelIndex(label);

    // Add current image to classifier
    knn.addExample(logits, index);
  }

  const numClasses = knn.getNumClasses();
  if (numClasses > 0) {

    // If classes have been added run predict
    logits = infer();
    const res = await knn.predictClass(logits, TOPK);

    // console.log(res);

    result = labels[res.classIndex];
  }

  // Dispose image when done
  image.dispose();
  if (logits != null) {
    logits.dispose();
  }

  return result;
}

function getLabelsWithCount() {
  return _.zip(labels, knn.getClassExampleCount());
}


function downloadClassifier() {
  const state = knn.getClassifierDataset();
  const data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const link = document.createElement('a');
  link.href = "data:' + data + '";
  link.download = "model.json";
  link.text = "dowload";
  document.body.append(link);
}

export {
  labels,
  downloadClassifier,
  infer,
  start,
  getLabelsWithCount,
}