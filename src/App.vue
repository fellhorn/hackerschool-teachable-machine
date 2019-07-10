<template>
  <div class="fridgecam">

    Model status: {{ modelLoaded ? "✔️" : "❌" }}
    <br>
    <button class="torch-btn" v-on:click="setLight(true)">🔦 on</button>
    <button class="torch-btn" v-on:click="setLight(false)">🔦 off</button>
    <br>

    <img v-bind:class="imageClass" alt="Fridgcam is loading..." src="http://192.168.172.97:8080/video" crossorigin="anonymous" ref="fridgeImage"
      onload="this."
    >
    <br>

    <div class="image-train-card">
      <img class="image-crop" :src="imageCrop1" ref="img1" />
      <br>
      {{ clsLabel1 }}
      <br>
      <input type="text" placeholder="New Class" v-model="label1"/><button v-on:mousedown="train = 1" v-on:mouseup="resetTrain" :disabled="label1 == ''">Train</button>
    </div>
    <div class="image-train-card">
      <img class="image-crop" :src="imageCrop2" ref="img2" />
      <br>
      {{ clsLabel2 }}
      <br>
      <input type="text" placeholder="New Class" v-model="label2"/><button v-on:mousedown="train = 2" v-on:mouseup="resetTrain" :disabled="label2 == ''">Train</button>
    </div>
    <div class="image-train-card">
      <img class="image-crop" :src="imageCrop3" ref="img3" />
      <br>
      {{ clsLabel3 }}
      <br>
      <input type="text" placeholder="New Class" v-model="label3" /><button v-on:mousedown="train = 3"  v-on:mouseup="resetTrain" :disabled="label3 == ''">Train</button>
    </div>
    <div class="image-train-card">
      <img class="image-crop" :src="imageCrop4" ref="img4" />
      <br>
      {{ clsLabel4 }}
      <br>
      <input type="text" placeholder="New Class" v-model="label4"/><button v-on:mousedown="train = 4" v-on:mouseup="resetTrain" :disabled="label4 == ''">Train</button>
    </div>
  </div>
</template>

<script>
import {getClippedRegion} from './image-clip';
import * as classifier from './classifier';

const UNKNOWN_LABEL = "???";

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
  }),
  created: async function() {
    await classifier.start();
    this.modelLoaded = true;
  },
  mounted: function() {
    this.$refs.fridgeImage.onload = this.imageLoaded;
  },
  methods: {
    resetTrain: function() {
      this.train = -1;
      this.trainedLabels = classifier.getLabelsWithCount();
    },
    setLight: function(status) {
      fetch('http://localhost:3000/devices', {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "light": status ? 'on': 'off'
        }),
      });
    },
    imageLoaded: function() {
      this.imageWidth = this.$refs.fridgeImage.width;
      this.imageHeight = this.$refs.fridgeImage.height;

      this.imageClass = "fridgecam-img-size-changed";
      window.setTimeout(() => {
        this.timer = requestAnimationFrame(this.handleImage.bind(this));
      });
    },
    handleImage: async function() {
      try {
        const cropWidth = Math.round(this.imageWidth / 4);
        this.imageCrop1 = getClippedRegion(this.$refs.fridgeImage, 0, 0, cropWidth, this.imageHeight).toDataURL("image/png");
        this.imageCrop2 = getClippedRegion(this.$refs.fridgeImage, cropWidth, 0, cropWidth, this.imageHeight).toDataURL("image/png");
        this.imageCrop3 = getClippedRegion(this.$refs.fridgeImage, 2 * cropWidth, 0, cropWidth, this.imageHeight).toDataURL("image/png");
        this.imageCrop4 = getClippedRegion(this.$refs.fridgeImage, 3 * cropWidth, 0, cropWidth, this.imageHeight).toDataURL("image/png");

        const prom1 = classifier.infer(this.$refs.img1, this.train == 1 ? this.label1 : "");
        const prom2 = classifier.infer(this.$refs.img2, this.train == 2 ? this.label2 : "");
        const prom3 = classifier.infer(this.$refs.img3, this.train == 3 ? this.label3 : "");
        const prom4 = classifier.infer(this.$refs.img4, this.train == 4 ? this.label4 : "");

        [this.clsLabel1, this.clsLabel2, this.clsLabel3, this.clsLabel4] = await Promise.all([prom1, prom2, prom3, prom4]);
      } catch (e) {
        console.error(e);
      }
      // this.timer = window.setTimeout(this.handleImage.bind(this), 500);
      this.timer = requestAnimationFrame(this.handleImage.bind(this));
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
</style>
