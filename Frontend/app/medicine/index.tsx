import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { router } from 'expo-router';

export default function MedicineScreen() {
  return (
    <View style={styles.container}>
      <Button
        mode="contained"
        onPress={() => router.push('/medicine/vendors')}
        style={styles.button}
      >
        Select Vendor
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  button: {
    marginVertical: 10,
    width: '100%',
  },
}); 