'use strict';

import {
  init
} from './shared-orbitcontrols.js';

import {
  EventDispatcher
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

function noop() {
  // no operation, 즉 빈 함수임.
  // 이것도 OrbitControls가 DOMElement로부터 받는 event의 event.preventDefault, event.stopPropagation을 사용하기 때문인데
  // 얘내들은 메인 스크립트에서 처리해주는 작업이기 때문에 그냥 빈 함수를 호출하라는 의미에서 구색만 맞춘거임.
}

// EventDispatcher는 three.js 객체로, 사용자 지정 객체에 대한 자바스크립트 이벤트 객체와 유사함
// 자바스크립트 이벤트 객체처럼 addEventListener, removeEventListener 등의 메서드를 가지고 있음.
// 그니까 이거는 DOM은 아니지만 DOM에서 발생한 이벤트를 넘겨받아서 동일한 유형의 이벤트를 얘로 내보내는 전략인거지.
// 어디로 내보낼까? OrbitControls로 내보내겠지. 왜냐면, OrbitControls는 여러 이벤트를 받을 수 있는 DOM 객체를 인자로 받아야되니까
// 근데 웹워커에서는 DOM을 참조할 수 없다고 했으니 DOM event 대신 DOM 이벤트와 유사한 구조의 객체를 EventDispatcher를 이용해서 내보내려는 거임.
class ElementProxyReceiver extends EventDispatcher {
  constructor() {
    super(); // 부모 클래스인 EventDispatcher의 생성자 함수를 호출해서 그 안의 속성값들을 상속받겠지
  }

  // OrbitControls에서 사용하는 clientWidth, clientHeight값을 리턴해주기 위해 워커측에서 작성해줘야 하는 코드들
  get clientWidth() {
    return this.width;
  }
  get clientHeight() {
    return this.height;
  }
  getBoundingClientRect() { // 얘도 지금 어디서 호출하는건 아닌데 OrbitControls가 사용하는 메서드이기 때문에 작성해준거 같음.
    return {
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      right: this.left + this.width,
      bottom: this.top + this.height
    };
  }

  handleEvent(data) {
    // OrbitControls에서 사용하는 clientWidth, clientHeight값을 리턴해주기 위해 워커측에서 작성해준 코드들
    if (data.type === 'size') {
      this.left = data.left;
      this.top = data.top;
      this.width = data.width;
      this.height = data.height;
      return;
    }

    // 얘내들은 전부 메인 스크립트에서 처리해주는 작업이니 빈 함수 호출해서 구색만 맞추도록 하는거임.
    data.preventDefault = noop;
    data.stopPropagation = noop;

    // dispatchEvent는 부모 클래스인 EventDispatch로부터 상속받은 메소드로,
    // 인자로 전달받은 event와 동일한 유형의 이벤트를 실행한다고 함. 
    this.dispatchEvent(data);
  }

  // 이거는 OrbitControls가 DOMElement로 받는 요소로부터 focus라는 메서드를 호출하기 때문에
  // 그냥 구색 맞추기 용으로 만들어놓은 메서드임. OrbitControls가 DOMElement로 인식할 수 있도록 완전히 속이기 위해 똑같이 만드는거임.
  focus() {
    // 빈 함수
  }
}

// ElementProxyReceiver는 하나의 DOM 요소만 대신할 수 있으므로, 나중에 여러 캔버스를 사용할 것을 고려해 여러 ElementProxyReceiver를 관리하는 클래스를 만듦
class ProxyManager {
  constructor() {
    this.target = {};
    this.handleEvent = this.handleEvent.bind(this);
  }

  makeProxy(data) {
    const {
      id
    } = data; // 먼저 data(즉, 메시지로 받은 속성값들)안의 id값을 const id에 할당
    const proxy = new ElementProxyReceiver(); // 새로운 프록시 인스턴스 생성함. 얘는 결국 EventDispatcher의 인스턴스이기도 함. 이걸 상속해서 몇가지가 추가된 클래스를 만들었을 뿐임.
    this.target[id] = proxy; // this.target = {id: proxy} 요렇게 id를 key값으로, 생성한 프록시 인스턴스를 value로 저장함.
  }

  getProxy(id) {
    return this.target[id]; // 인자로 전달받은 id를 key로 가지고있는 proxy를 리턴해 줌.
  }

  handleEvent(data) {
    this.target[data.id].handleEvent(data.data); // 넘겨받은 data객체 안에 존재하는 id값에 해당하는 프록시 인스턴스의 handleEvent 메서드를 호출함.
  }
}

const proxyManager = new ProxyManager(); // 프록시매니저의 인스턴스를 만듦.

// 프록시매니저 인스턴스에 저장되어있는 프록시 인스턴스(EventDispatcher 인스턴스)를 가져온 뒤, 
// 넘겨받은 data 객체안에 존재하는 canvas와 proxy를 할당하면서 shared-obitcontrols.js의 init 함수를 호출함.
function start(data) {
  const proxy = proxyManager.getProxy(data.canvasId);

  // OrbitControls는 마우스 이벤트를 감지하기 위해 해당 요소의 ownerDocument에 pointermove, pointerup 리스너를 추가해야 하는데
  // 이거를 약간의 편법을 사용해서 다음과 같이 추가할 수 있음.
  proxy.ownerDocument = proxy;

  // 또 OrbitControls는 전역 document 객체를 참조하지만 워커에는 전역 document를 참조할 수 없으니 그냥 빈 객체를 할당해주는 것.
  self.document = {};

  init({
    canvas: data.canvas,
    inputElement: proxy, // 얘는 init함수에서 OrbitCotrols를 생성할 때 이벤트를 받는 DOM 객체 대신 넘겨주는 EventDispatcher 객체임.
  });
}

// 프록시매니저 인스턴스를 통해서 새로운 프록시 인스턴스를 생성하는 함수
function makeProxy(data) {
  proxyManager.makeProxy(data);
}

const handlers = {
  start, // 이 함수는 생성된 프록시 인스턴스를 가져와서 캔버스와 함께 init함수에 넘겨주면서 호출하는 역할을 함.
  makeProxy,
  event: proxyManager.handleEvent, // 얘는 아마도 event가 key이고, 이 type이 전달되면 프록시매니저의 handleEvent 메소드를 호출하도록 하는거 같음.
};

self.onmessage = function (e) {
  const fn = handlers[e.data.type];
  if (!fn) {
    throw new Error('no handler for type: ' + e.data.type);
  }
  fn(e.data);
}