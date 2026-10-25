import * as THREE from 'three';
import { LIGHTS, PLAYER, FOG, PALETTE } from './config.js';
import { U } from './world/shared.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LIGHTS.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.fog);
scene.fog = new THREE.FogExp2(PALETTE.fog, FOG.density);

const camera = new THREE.PerspectiveCamera(PLAYER.fov, innerWidth / innerHeight, 0.05, 500);
camera.position.set(...PLAYER.start);

scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x333333 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  U.time.value += Math.min(clock.getDelta(), 0.05);
  renderer.render(scene, camera);
});
