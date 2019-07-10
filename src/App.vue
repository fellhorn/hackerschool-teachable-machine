<template>
  <v-app>
    <v-toolbar app>
      <v-layout>
        <v-flex xs2 pa-3 class="torch-btn" >
          Model: {{ modelLoaded ? "✔️" : "❌" }}
        </v-flex>
      </v-layout>     
    </v-toolbar>
    <v-content class="text-xs-center">
      <div class="fridgecam">
        <video ref="video" autoplay="" playsinline="" />
        <br>

        <v-layout>
          <v-flex xs1 pa-3 />  
          <v-flex xs2 pa-3>
            <v-card class="text-xs-center">
              <v-card-title primary-title>
                <h3 class="headline ml-3">{{ clsLabel1 | filterLabel }}</h3>
              </v-card-title>
              <video ref="video_small" autoplay="" playsinline="" />
              <br>
              <v-combobox hide-no-data :items="labelNames" label="New Class" v-model="label1"/><v-btn v-on:mousedown="train = 1" v-on:mouseup="resetTrain" :disabled="label1 == ''">🔬 Train</v-btn>
            </v-card>
          </v-flex>
          <!-- <v-flex xs2 pa-3>
            <v-card>
              <v-card-title primary-title :class="freshState(clsLabel2)"><h3 class="headline ml-3">{{ clsLabel2 | filterLabel }}: {{freshState(clsLabel2)}}</h3>
              </v-card-title>
              <img class="image-crop" :src="imageCrop2" ref="img2" />
              <br>
              <v-combobox hide-no-data :items="labelNames" label="New Class" v-model="label2"/><v-btn v-on:mousedown="train = 2" v-on:mouseup="resetTrain" :disabled="label2 == ''">🔬 Train</v-btn>
            </v-card>
          </v-flex>
          <v-flex xs2 pa-3>
            <v-card>
              <v-card-title primary-title :class="freshState(clsLabel3)"><h3 class="headline ml-3">{{ clsLabel3 | filterLabel }}: {{freshState(clsLabel3)}}</h3>
              </v-card-title>
              <img class="image-crop" :src="imageCrop3" ref="img3" />
              <br>
              <v-combobox hide-no-data :items="labelNames" label="New Class" v-model="label3"/><v-btn v-on:mousedown="train = 3" v-on:mouseup="resetTrain" :disabled="label3 == ''">🔬 Train</v-btn>
            </v-card>
          </v-flex>
        <v-flex xs2 pa-3>
          <v-card>
            <v-card-title primary-title :class="freshState(clsLabel4)"><h3 class="headline ml-3">{{ clsLabel4 | filterLabel }}: {{freshState(clsLabel4)}}</h3>
            </v-card-title>
            <img class="image-crop" :src="imageCrop4" ref="img4" />
            <br>
              <v-combobox hide-no-data :items="labelNames" label="New Class" v-model="label4"/><v-btn v-on:mousedown="train = 4" v-on:mouseup="resetTrain" :disabled="label4 == ''">🔬 Train</v-btn>
          </v-card>
        </v-flex> -->
        <v-flex xs2 pa-3>
          <v-card>
            <v-card-title primary-title><h3 class="headline ml-3">Trained labels:</h3></v-card-title>
            <ul class="text-xs-left">
              <li v-for="item in sortedLabels" :key="item.label">
              <b>{{ item.label }}</b>: {{ item.count }}
              </li>
            </ul>
            <v-btn v-on:click="saveModel" disabled>Save model</v-btn>
            <v-btn v-on:click="restoreModel">Restore model</v-btn>
            <v-btn v-on:click="downloadModel">Dowload model</v-btn>
            <br>
            Upload model:
            <input type="file" id="files" ref="fileUpload" name="file" />
          </v-card>
        </v-flex>
      </v-layout>
      </div>
    </v-content> 
  </v-app> 
</template>

<script>
import * as _ from 'lodash';
import {getClippedRegion} from './image-clip';
import * as classifier from './classifier';

// Webcam Image size. Must be 227. 
const IMAGE_SIZE = 227;
const UNKNOWN_LABEL = "???";
const PREDEFINED_LABELS = [
  ""
];
const SPOILED_AFTER = 10 * 1000;

export default {
  name: 'Fridgecam',
  components: {
  },
  data: () => ({
    imageWidth: 0,
    imageHeight: 0,
    timer: null,
    imageClass: '',
    imageCrop1: null,
    imageCrop2: null,
    imageCrop3: null,
    imageCrop4: null,
    label1: "",
    label2: "",
    label3: "",
    label4: "",
    clsLabel1: UNKNOWN_LABEL,
    clsLabel2: UNKNOWN_LABEL,
    clsLabel3: UNKNOWN_LABEL,
    clsLabel4: UNKNOWN_LABEL,
    modelLoaded: false,
    train: -1,
    trainedLabels: [],
    videoPlaying: false,
    socket: new WebSocket('ws://localhost:8081')
  }),
  created: async function() {
    // Setup webcam
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        this.$refs.video.srcObject = stream;
        this.$refs.video_small.srcObject = stream;
        this.$refs.video_small.width = IMAGE_SIZE;
        this.$refs.video_small.height = IMAGE_SIZE;

        this.$refs.video_small.addEventListener('playing', () => this.videoPlaying = true);
        this.$refs.video_small.addEventListener('paused', () => this.videoPlaying = false);

        this.onVideoLoaded();
    })

    await classifier.start();
    this.modelLoaded = true;
  },
  filters: {
    filterLabel: function(text) {
      return text ? text : '???';
    }
  },
  mounted: function() {
    this.$refs.fridgeImage.onload = this.imageLoaded;

    this.$refs.fileUpload.addEventListener('change', this.uploadModel, false);
    this.syncProducts();
  },
  computed: {
    sortedLabels: function() {
      return _(this.trainedLabels).sortBy('count').reverse().value();
    },
    labelNames: function() {
      return this.trainedLabels.map(label => label.label);
    }
  },
  methods: {
    resetTrain: function() {
      this.train = -1;
    },
    onVideoLoaded: function() {
      window.setTimeout(() => {
        this.timer = requestAnimationFrame(this.handleImage.bind(this));
      });
    },
    handleImage: async function() {
      if (this.videoPlaying && this.modelLoaded) {
        try {
          // const cropWidth = Math.round(this.imageWidth / 4);
          // this.imageCrop1 = getClippedRegion(this.$refs.fridgeImage, 0, 0, cropWidth, this.imageHeight).toDataURL("image/png");
          // this.imageCrop2 = getClippedRegion(this.$refs.fridgeImage, cropWidth, 0, cropWidth, this.imageHeight).toDataURL("image/png");
          // this.imageCrop3 = getClippedRegion(this.$refs.fridgeImage, 2 * cropWidth, 0, cropWidth, this.imageHeight).toDataURL("image/png");
          // this.imageCrop4 = getClippedRegion(this.$refs.fridgeImage, 3 * cropWidth, 0, cropWidth, this.imageHeight).toDataURL("image/png");
  
          // const prom1 = classifier.infer(this.$refs.img1, this.train == 1 ? this.label1 : "");
          // const prom2 = classifier.infer(this.$refs.img2, this.train == 2 ? this.label2 : "");
          // const prom3 = classifier.infer(this.$refs.img3, this.train == 3 ? this.label3 : "");
          // const prom4 = classifier.infer(this.$refs.img4, this.train == 4 ? this.label4 : "");

          // [this.clsLabel1, this.clsLabel2, this.clsLabel3, this.clsLabel4] = await Promise.all([prom1, prom2, prom3, prom4]);

          this.clsLabel1 = await classifier.infer(this.$refs.video_small, this.train == 1 ? this.label1 : "");
          this.socket.send(this.clsLabel1);
          this.trainedLabels = classifier.getLabelsWithCount();
        } catch (e) {
          console.error(e);
        }
      }
      // this.timer = window.setTimeout(this.handleImage.bind(this), 500);
      this.timer = requestAnimationFrame(this.handleImage.bind(this));
    },
    downloadModel: function() {
      classifier.downloadClassifier();
    },
    uploadModel: function(e) {
      var file = e.target.files[0];
      if (!file) {
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        var contents = e.target.result;
        const parsed = JSON.parse(contents);
        classifier.importClassifier(parsed);
      };
      reader.readAsText(file);
    },
    saveModel: function() {
      classifier.saveClassifierToLocalStorage();
    },
    restoreModel: function() {
      classifier.loadClassifierFromLocalStorage();
    }
  }
}
</script>

<style scoped>
img.fridgecam-img-size-changed {
  width: 1000px;
}
img.image-crop {
  width: 227px;
  height: 227px;
}
div.image-train-card {
  display: inline-block;
  margin-right: 3px;
  text-align: center;
}
.torch-btn {
  font-size: 30px;
}
div.left {
  text-align: left;
}
.good {
  color: darkgreen;
}
.bad {
  color: darkred;
}
</style>
