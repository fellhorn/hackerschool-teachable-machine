<template>
  <v-app>
    <v-toolbar app>
      <v-layout>
        <v-flex xs2 pa-3 class="torch-btn" >
          Model: {{ modelLoaded ? "✔️" : "❌" }}
        </v-flex>
        <v-flex xs2 pa-3 class="torch-btn" >
          Socket: {{ socketConnected ? "✔️" : "❌" }}
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
              <v-combobox hide-no-data :items="labelNames" label="Neues Label" v-model="label1"/><v-btn v-on:mousedown="train = 1" v-on:mouseup="resetTrain" :disabled="label1 == ''">🔬 Train</v-btn>
            </v-card>
          </v-flex>
          <v-flex xs2 pa-3>
            <v-card>
              <v-card-title primary-title><h3 class="headline ml-3">Trainierte labels:</h3></v-card-title>
              <ul class="text-xs-left">
                <li v-for="(item, index) in trainedLabels" :key="item.label">
                  <h3>{{ item.label }} ({{ item.count }})</h3>
                  <v-progress-linear
                    color="secondary"
                    height="10"
                    v-model="confidences[index]"
                  ></v-progress-linear>
                </li>
              </ul>
            </v-card>
          </v-flex>
          <v-flex xs2 pa-3>
            <v-card>
              <v-btn v-on:click="saveModel">Speichere model</v-btn>
              <v-card-title primary-title><h3 class="headline ml-3">Meine Klassifikatoren:</h3></v-card-title>
                <div v-for="name in classifiers" v-bind:key="name">
                  {{ name }}<v-btn v-on:click="restoreModel(name)">Lade</v-btn>
                </div>  
            </v-card>
          </v-flex>
      </v-layout>
      </div>
    </v-content> 
  </v-app> 
</template>

<script>
import * as _ from 'lodash';
import * as classifier from './classifier';

// Webcam Image size. Must be 227. 
const IMAGE_SIZE = 227;
const UNKNOWN_LABEL = "???";
const SOCKET_ADRESS = 'ws://localhost:8765';

export default {
  name: 'Hackerschool',
  components: {
  },
  data: () => ({
    imageWidth: 0,
    imageHeight: 0,
    timer: null,
    imageClass: '',
    label1: "",
    label2: "",
    label3: "",
    label4: "",
    clsLabel1: UNKNOWN_LABEL,
    modelLoaded: false,
    train: -1,
    trainedLabels: [],
    confidences: [80, 40, 20, 10, 0, 80],
    videoPlaying: false,
    socket: null,
    socketConnected: false,
    classifiers: [],
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

    try {
      this.classifiers = await classifier.listClassifiers();
    } catch {
      console.debug("No saved classifiers found");
      this.classifiers = [];
    }
    await classifier.start();
    this.modelLoaded = true;
  },
  filters: {
    filterLabel: function(text) {
      return text ? text : '???';
    }
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
      this.restoreSocket();
    },
    restoreSocket: function() {
      this.socket = new WebSocket(SOCKET_ADRESS);
      this.socket.onopen = () => {
        this.socketConnected = true;
        this.socket.onclose = (error) => {
          this.socketConnected = false;
          console.log('WebSocket Error ' + error);
          window.setTimeout(() => {
            this.restoreSocket();
          }, 200);
        };
      }
    },
    handleImage: async function() {
      if (this.videoPlaying && this.modelLoaded) {
        try {
          const rueckgabe = await classifier.infer(this.$refs.video_small, this.train == 1 ? this.label1 : "")
          console.log(rueckgabe[1]);
          this.clsLabel1 = rueckgabe[0];
          var neu_mal_hundert = [];

          for (var i=0;i<=rueckgabe[1].length;i++){
            neu_mal_hundert.push(rueckgabe[1][i]*100);
          }

          this.confidences = neu_mal_hundert;
          if (this.clsLabel1) {
            this.sendToServer(this.clsLabel1);
          }
          this.trainedLabels = classifier.getLabelsWithCount();
        } catch (e) {
          console.error(e);
        }
      }
      this.timer = requestAnimationFrame(this.handleImage.bind(this));
    },
    sendToServer: function(label, confidence = 1.0) {
      this.socket.send(JSON.stringify({
        zeit: new Date().getTime() / 1000,
        klassen: [{
          name: this.clsLabel1,
          konfidenz: confidence,
        }],
      }));
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
    saveModel: async function() {
      await classifier.saveClassifierToIndexedDB();
      this.classifiers = await classifier.listClassifiers();
    },
    restoreModel: function(id) {
      classifier.loadClassifierFromIndexedDB(id);
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
video {
  transform: rotateY(180deg);
  -webkit-transform:rotateY(180deg); /* Safari and Chrome */
  -moz-transform:rotateY(180deg); /* Firefox */
}
</style>
