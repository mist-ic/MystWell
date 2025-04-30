import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Surface, Button, TextInput, Portal, Modal, List, IconButton, Divider, RadioButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Vendor {
  id: string;
  name: string;
  phone: string;
  rating: number;
  deliveryTime: string;
}

interface Address {
  id: string;
  type: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export default function CheckoutScreen() {
  const theme = useTheme();
  const router = useRouter();

  // Mock data - replace with actual data management
  const [vendors, setVendors] = useState<Vendor[]>([
    {
      id: '1',
      name: 'MedPlus Pharmacy',
      phone: '+91 9876543210',
      rating: 4.5,
      deliveryTime: '30-45 mins',
    },
    {
      id: '2',
      name: 'Apollo Pharmacy',
      phone: '+91 9876543211',
      rating: 4.3,
      deliveryTime: '45-60 mins',
    },
  ]);

  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: '1',
      type: 'Home',
      line1: '123, Park Avenue',
      line2: 'Near City Mall',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      isDefault: true,
    },
    {
      id: '2',
      type: 'Office',
      line1: '456, Business Park',
      line2: 'Tech Hub',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400002',
      isDefault: false,
    },
  ]);

  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>(
    addresses.find(addr => addr.isDefault)?.id || addresses[0]?.id || ''
  );
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [showEditAddress, setShowEditAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const [newVendor, setNewVendor] = useState({
    name: '',
    phone: '',
  });

  const [newAddress, setNewAddress] = useState<Partial<Address>>({
    type: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });

  const handleAddVendor = () => {
    if (newVendor.name && newVendor.phone) {
      const vendor: Vendor = {
        id: (vendors.length + 1).toString(),
        name: newVendor.name,
        phone: newVendor.phone,
        rating: 0,
        deliveryTime: 'New Vendor',
      };
      setVendors([...vendors, vendor]);
      setSelectedVendor(vendor.id);
      setShowAddVendor(false);
      setNewVendor({ name: '', phone: '' });
    }
  };

  const handleAddAddress = () => {
    if (newAddress.line1 && newAddress.city && newAddress.pincode) {
      const address: Address = {
        id: (addresses.length + 1).toString(),
        type: newAddress.type || 'Other',
        line1: newAddress.line1,
        line2: newAddress.line2 || '',
        city: newAddress.city,
        state: newAddress.state || '',
        pincode: newAddress.pincode,
        isDefault: addresses.length === 0,
      };
      setAddresses([...addresses, address]);
      setSelectedAddress(address.id);
      setShowAddAddress(false);
      setNewAddress({});
    }
  };

  const handleEditAddress = () => {
    if (editingAddress && editingAddress.line1 && editingAddress.city && editingAddress.pincode) {
      setAddresses(addresses.map(addr => 
        addr.id === editingAddress.id ? editingAddress : addr
      ));
      setShowEditAddress(false);
      setEditingAddress(null);
    }
  };

  const handleProceed = () => {
    if (selectedVendor && selectedAddress) {
      // Handle order placement
      router.push('/medicine/order-confirmation');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="headlineSmall" style={styles.title}>Checkout</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Delivery Address Section */}
        <Surface style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Delivery Address</Text>
            <Button
              mode="text"
              onPress={() => setShowAddAddress(true)}
              style={styles.addButton}
            >
              Add New
            </Button>
          </View>
          
          <RadioButton.Group onValueChange={value => setSelectedAddress(value)} value={selectedAddress}>
            {addresses.map((address) => (
              <Surface key={address.id} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <RadioButton.Item
                    label={address.type}
                    value={address.id}
                    position="leading"
                    style={styles.radioItem}
                  />
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => {
                      setEditingAddress(address);
                      setShowEditAddress(true);
                    }}
                  />
                </View>
                <Text style={styles.addressText}>{address.line1}</Text>
                {address.line2 && <Text style={styles.addressText}>{address.line2}</Text>}
                <Text style={styles.addressText}>
                  {address.city}, {address.state} {address.pincode}
                </Text>
              </Surface>
            ))}
          </RadioButton.Group>
        </Surface>

        {/* Vendor Selection Section */}
        <Surface style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Select Vendor</Text>
            <Button
              mode="text"
              onPress={() => setShowAddVendor(true)}
              style={styles.addButton}
            >
              Add New
            </Button>
          </View>

          <RadioButton.Group onValueChange={value => setSelectedVendor(value)} value={selectedVendor || ''}>
            {vendors.map((vendor) => (
              <Surface key={vendor.id} style={styles.vendorCard}>
                <RadioButton.Item
                  label={vendor.name}
                  value={vendor.id}
                  position="leading"
                  style={styles.radioItem}
                />
                <View style={styles.vendorDetails}>
                  <Text variant="bodyMedium" style={styles.vendorPhone}>{vendor.phone}</Text>
                  <View style={styles.vendorStats}>
                    <View style={styles.rating}>
                      <MaterialCommunityIcons name="star" size={16} color={theme.colors.primary} />
                      <Text>{vendor.rating}</Text>
                    </View>
                    <Text style={styles.deliveryTime}>{vendor.deliveryTime}</Text>
                  </View>
                </View>
              </Surface>
            ))}
          </RadioButton.Group>
        </Surface>
      </ScrollView>

      {/* Bottom Bar */}
      <Surface style={styles.bottomBar} elevation={4}>
        <Button
          mode="contained"
          onPress={handleProceed}
          style={styles.proceedButton}
          disabled={!selectedVendor || !selectedAddress}
        >
          Place Order
        </Button>
      </Surface>

      {/* Add Vendor Modal */}
      <Portal>
        <Modal
          visible={showAddVendor}
          onDismiss={() => setShowAddVendor(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Add New Vendor</Text>
          
          <TextInput
            label="Vendor Name"
            value={newVendor.name}
            onChangeText={text => setNewVendor({ ...newVendor, name: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Phone Number"
            value={newVendor.phone}
            onChangeText={text => setNewVendor({ ...newVendor, phone: text })}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowAddVendor(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddVendor}
              style={styles.modalButton}
              disabled={!newVendor.name || !newVendor.phone}
            >
              Add Vendor
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Add Address Modal */}
      <Portal>
        <Modal
          visible={showAddAddress}
          onDismiss={() => setShowAddAddress(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Add New Address</Text>
          
          <TextInput
            label="Address Type (e.g., Home, Office)"
            value={newAddress.type}
            onChangeText={text => setNewAddress({ ...newAddress, type: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Address Line 1"
            value={newAddress.line1}
            onChangeText={text => setNewAddress({ ...newAddress, line1: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Address Line 2 (Optional)"
            value={newAddress.line2}
            onChangeText={text => setNewAddress({ ...newAddress, line2: text })}
            style={styles.input}
          />
          
          <TextInput
            label="City"
            value={newAddress.city}
            onChangeText={text => setNewAddress({ ...newAddress, city: text })}
            style={styles.input}
          />
          
          <TextInput
            label="State"
            value={newAddress.state}
            onChangeText={text => setNewAddress({ ...newAddress, state: text })}
            style={styles.input}
          />
          
          <TextInput
            label="PIN Code"
            value={newAddress.pincode}
            onChangeText={text => setNewAddress({ ...newAddress, pincode: text })}
            keyboardType="numeric"
            style={styles.input}
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowAddAddress(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddAddress}
              style={styles.modalButton}
              disabled={!newAddress.line1 || !newAddress.city || !newAddress.pincode}
            >
              Add Address
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Edit Address Modal */}
      <Portal>
        <Modal
          visible={showEditAddress}
          onDismiss={() => {
            setShowEditAddress(false);
            setEditingAddress(null);
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Edit Address</Text>
          
          {editingAddress && (
            <>
              <TextInput
                label="Address Type"
                value={editingAddress.type}
                onChangeText={text => setEditingAddress({ ...editingAddress, type: text })}
                style={styles.input}
              />
              
              <TextInput
                label="Address Line 1"
                value={editingAddress.line1}
                onChangeText={text => setEditingAddress({ ...editingAddress, line1: text })}
                style={styles.input}
              />
              
              <TextInput
                label="Address Line 2 (Optional)"
                value={editingAddress.line2}
                onChangeText={text => setEditingAddress({ ...editingAddress, line2: text })}
                style={styles.input}
              />
              
              <TextInput
                label="City"
                value={editingAddress.city}
                onChangeText={text => setEditingAddress({ ...editingAddress, city: text })}
                style={styles.input}
              />
              
              <TextInput
                label="State"
                value={editingAddress.state}
                onChangeText={text => setEditingAddress({ ...editingAddress, state: text })}
                style={styles.input}
              />
              
              <TextInput
                label="PIN Code"
                value={editingAddress.pincode}
                onChangeText={text => setEditingAddress({ ...editingAddress, pincode: text })}
                keyboardType="numeric"
                style={styles.input}
              />

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setShowEditAddress(false);
                    setEditingAddress(null);
                  }}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleEditAddress}
                  style={styles.modalButton}
                  disabled={!editingAddress.line1 || !editingAddress.city || !editingAddress.pincode}
                >
                  Save Changes
                </Button>
              </View>
            </>
          )}
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  addButton: {
    marginRight: -8,
  },
  addressCard: {
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radioItem: {
    paddingLeft: 0,
  },
  addressText: {
    marginLeft: 52,
    marginBottom: 4,
    opacity: 0.7,
  },
  vendorCard: {
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  vendorDetails: {
    marginLeft: 52,
  },
  vendorPhone: {
    opacity: 0.7,
    marginBottom: 4,
  },
  vendorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryTime: {
    opacity: 0.7,
  },
  bottomBar: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  proceedButton: {
    paddingVertical: 8,
  },
  modal: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 20,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    minWidth: 100,
  },
}); 