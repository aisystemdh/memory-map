import { registerRootComponent } from 'expo';

import RootApp from './RootApp';

// registerRootComponent calls AppRegistry.registerComponent('main', () => RootApp);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
// RootApp은 로그인 게이트로 기존 App(지도 메인)을 감싼다.
registerRootComponent(RootApp);
