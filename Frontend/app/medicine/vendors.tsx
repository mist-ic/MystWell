import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Button, Card, IconButton, Modal, Portal, TextInput, Title, Text } from 'react-native-paper';
import { router } from 'expo-router';

interface Vendor {
  id: string;
  name: string;
  phone: string;
  rating: number;
  deliveryTime: string;
  address: string;
}

const initialVendors: Vendor[] = [
  {
    id: '1',
    name: 'MedPlus Pharmacy',
    phone: '+91 9876543210',
    rating: 4.5,
    deliveryTime: '30-45 mins',
    address: '123 Healthcare Street, Medical District'
  },
  {
    id: '2',
    name: 'Apollo Pharmacy',
    phone: '+91 9876543211',
    rating: 4.2,
    deliveryTime: '45-60 mins',
    address: '456 Wellness Road, Health Hub'
  },
];

export default function VendorsScreen() {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newVendor, setNewVendor] = useState<Partial<Vendor>>({});

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addVendor = () => {
    if (newVendor.name && newVendor.phone && newVendor.address) {
      const vendor: Vendor = {
        id: Date.now().toString(),
        name: newVendor.name,
        phone: newVendor.phone,
        rating: 0,
        deliveryTime: 'New Vendor',
        address: newVendor.address,
      };
      setVendors([...vendors, vendor]);
      setModalVisible(false);
      setNewVendor({});
    }
  };

  const renderVendor = ({ item }: { item: Vendor }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Title>{item.name}</Title>
        <Text>Phone: {item.phone}</Text>
        <Text>Rating: {item.rating} ⭐</Text>
        <Text>Delivery Time: {item.deliveryTime}</Text>
        <Text>Address: {item.address}</Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => router.push({
          pathname: '/medicine/checkout',
          params: { vendorId: item.id }
        })}>
          Select Vendor
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search vendors..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />
      
      <FlatList
        data={filteredVendors}
        renderItem={renderVendor}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
      />

      <IconButton
        icon="plus"
        mode="contained"
        size={24}
        onPress={() => setModalVisible(true)}
        style={styles.fab}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Title>Add New Vendor</Title>
          <TextInput
            label="Name"
            value={newVendor.name}
            onChangeText={text => setNewVendor({ ...newVendor, name: text })}
            style={styles.input}
          />
          <TextInput
            label="Phone"
            value={newVendor.phone}
            onChangeText={text => setNewVendor({ ...newVendor, phone: text })}
            style={styles.input}
          />
          <TextInput
            label="Address"
            value={newVendor.address}
            onChangeText={text => setNewVendor({ ...newVendor, address: text })}
            style={styles.input}
          />
          <Button onPress={addVendor} mode="contained" style={styles.button}>
            Add Vendor
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    marginBottom: 16,
  },
  list: {
    paddingBottom: 80,
  },
  card: {
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 16,
  },
}); 