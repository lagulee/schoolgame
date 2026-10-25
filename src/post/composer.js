import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { POST } from '../config.js';
import { GradeShader } from './gradeShader.js';

// RenderPass → UnrealBloom → OutputPass(톤매핑·sRGB) → Grade(비네팅·그레인·색수차·그레이딩)
export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const b = POST.bloom;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), b.strength, b.radius, b.threshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.enabled = true;
    this.flags = { bloom: true, grain: true, vignette: true, grade: true };
    this.qualityBloom = true;
    this.qualityGrade = true;
  }

  setQuality(q) {
    this.enabled = q.post;
    this.qualityBloom = q.bloom;
    this.qualityGrade = q.grade;
  }

  toggle(name) {
    this.flags[name] = !this.flags[name];
    return this.flags[name];
  }

  setSize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(t) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.bloom.enabled = this.flags.bloom && this.qualityBloom;
    const u = this.grade.uniforms;
    u.uTime.value = t;
    u.uGrain.value = this.flags.grain ? POST.grain : 0;
    u.uVignette.value = this.flags.vignette ? POST.vignette : 0;
    u.uCA.value = POST.aberration;
    u.uGrade.value = 1;
    this.grade.enabled = this.qualityGrade;
    // EffectComposer 가 마지막 활성 패스만 화면에 출력한다
    this.composer.render();
  }
}
