import React from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
};

/**
 * Wraps every screen with SafeAreaView and the consistent dark status bar
 * that matches the light-background header design.
 */
export default function ScreenWrapper({ children }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.card} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});
