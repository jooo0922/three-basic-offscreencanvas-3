'use strict';

import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';

import {
  OrbitControls
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';

export function init(data) {
  const {
    canvas,
    inputElement
  } = data;
  const renderer = new THREE.WebGLRenderer({
    canvas
  });

  const fov = 75;
  const aspect = 2
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

  camera.position.z = 4;

  // OrbitControls 생성
  // 이벤트를 받는 DOM객체 대신 이벤트를 경유해서 내보내주는 경유 객체(inputElement)를 워커용 스크립트에서 만들어와서 넘겨줌.
  const controls = new OrbitControls(camera, inputElement);
  controls.target.set(0, 0, 0); // OrbitControls가 카메라를 원점을 중심으로 돌도록 설정함
  controls.update();

  const scene = new THREE.Scene();

  {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(-1, 2, 4);
    scene.add(light);
  }

  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

  function makeInstance(geometry, color, x) {
    const material = new THREE.MeshPhongMaterial({
      color
    });

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    cube.position.x = x;

    return cube;
  }

  const cubes = [
    makeInstance(geometry, 0x44aa88, 0),
    makeInstance(geometry, 0x8844aa, -2),
    makeInstance(geometry, 0xaa8844, 2),
  ];

  // 물체를 피킹(picking)할 수 있도록 RayCaster 예제에서 코드 일부를 가져옴.
  // 이 코드는 나중에 RayCaster를 사용해서 물체를 피킹하는 방법에 대해서 배울 때 공부할거임.
  class PickHelper {
    constructor() {
      this.raycaster = new THREE.Raycaster();
      this.pickedObject = null;
      this.pickedObjectSavedColor = 0;
    }
    pick(normalizedPosition, scene, camera, time) {
      // 이미 다른 물체를 피킹했다면 색을 복원합니다
      if (this.pickedObject) {
        this.pickedObject.material.emissive.setHex(this.pickedObjectSavedColor);
        this.pickedObject = undefined;
      }

      // 절두체 안에 광선을 쏩니다
      this.raycaster.setFromCamera(normalizedPosition, camera);
      // 광선과 교차하는 물체들을 배열로 만듭니다
      const intersectedObjects = this.raycaster.intersectObjects(scene.children);
      if (intersectedObjects.length) {
        // 첫 번째 물체가 제일 가까우므로 해당 물체를 고릅니다
        this.pickedObject = intersectedObjects[0].object;
        // 기존 색을 저장해둡니다
        this.pickedObjectSavedColor = this.pickedObject.material.emissive.getHex();
        // emissive 색을 빨강/노랑으로 빛나게 만듭니다
        this.pickedObject.material.emissive.setHex((time * 8) % 2 > 1 ? 0xFFFF00 : 0xFF0000);
      }
    }
  }

  const pickPosition = {
    x: -2,
    y: -2
  }; // 얘는 메인 스크립트나 워커스크립트에서 마우스 좌표값을 지정하는게 아닌 three.js 스크립트 내에서만 사용하려고 만들어놓은거.
  const pickHelper = new PickHelper();
  clearPickPosition();

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;

    // WebGLRenderer를 리사이징하는 메소드에서도 stage 객체의 값들을 쓰도록 변경해 줌.
    const width = inputElement.clientWidth;
    const height = inputElement.clientHeight;

    const needResize = canvas.width !== width || canvas.height !== height;

    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  }

  function animate(t) {
    t *= 0.001;

    if (resizeRendererToDisplaySize(renderer)) {
      camera.aspect = inputElement.clientWidth / inputElement.clientHeight; // 카메라의 aspect도 state 객체의 값으로 계산하도록 변경해 줌.
      camera.updateProjectionMatrix();
    }

    cubes.forEach((cube, index) => {
      const speed = 1 + index * 0.1;
      const rotate = t * speed;
      cube.rotation.x = rotate;
      cube.rotation.y = rotate;
    });

    // pickPosition을 전달하면서 pickHelper의 pick 메소드를 호출함.
    pickHelper.pick(pickPosition, scene, camera, t);

    renderer.render(scene, camera);

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

  // 메인 스크립트에서 마우스이벤트 또는 터치 이벤트를 받아서 pickPosition에 값을 기록해줄 때 사용하던 코드들을
  // three.js 스크립트로 바로 가져와서 프록시 요소를 통해서 이벤트를 받아와서 picking에 필요한 pickPosition 좌표값을 업데이트 해주는거임.
  function getCanvasRelativePosition(event) {
    const rect = inputElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function setPickPosition(event) {
    const pos = getCanvasRelativePosition(event);
    pickPosition.x = (pos.x / inputElement.clientWidth) * 2 - 1;
    pickPosition.y = (pos.y / inputElement.clientHeight) * -2 + 1; // y방향으로 뒤집음
  }

  function clearPickPosition() {
    pickPosition.x = -100000;
    pickPosition.y = -100000;
  }

  inputElement.addEventListener('mousemove', setPickPosition);
  inputElement.addEventListener('mouseout', clearPickPosition);
  inputElement.addEventListener('mouseleave', clearPickPosition);

  inputElement.addEventListener('touchstart', (event) => {
    event.preventDefault();
    setPickPosition(event.touches[0]);
  }, {
    passive: false
  });

  inputElement.addEventListener('touchmove', (event) => {
    setPickPosition(event.touches[0]);
  });

  inputElement.addEventListener('touchend', clearPickPosition);
}