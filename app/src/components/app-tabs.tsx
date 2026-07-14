import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>ホーム</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="log">
        <NativeTabs.Trigger.Label>ログ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.clipboard" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="timer">
        <NativeTabs.Trigger.Label>タイマー</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="timer" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>探す</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="info">
        <NativeTabs.Trigger.Label>情報</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mypage">
        <NativeTabs.Trigger.Label>マイページ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
