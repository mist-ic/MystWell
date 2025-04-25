import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, IconButton, useTheme, Button, Surface, List, Divider, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CartItem extends Medicine {
  orderQuantity: number;
}

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  quantity: {
    current: number;
    total: number;
    unit: string;
  };
}

export default function CartScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  // Mock cart items - replace with actual cart state management
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: '1',
      name: "Amoxicillin",
      dosage: "500mg",
      quantity: {
        current: 14,
        total: 30,
        unit: "tablets"
      },
      orderQuantity: 1
    }
  ]);

  const updateQuantity = (itemId: string, change: number) => {
    setCartItems(items =>
      items.map(item => {
        if (item.id === itemId) {
          const newQuantity = Math.max(1, item.orderQuantity + change);
          return { ...item, orderQuantity: newQuantity };
        }
        return item;
      })
    );
  };

  const removeItem = (itemId: string) => {
    setCartItems(items => items.filter(item => item.id !== itemId));
  };

  const getTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + item.orderQuantity, 0);
  };

  const handleCheckout = () => {
    router.push('/medicine/checkout');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="headlineSmall" style={styles.title}>Cart</Text>
        <View style={styles.cartCount}>
          <MaterialCommunityIcons name="cart" size={24} color={theme.colors.primary} />
          <Text style={[styles.cartBadge, { color: theme.colors.primary }]}>
            {getTotalItems()}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {cartItems.length > 0 ? (
          <Surface style={[styles.cartItems, { backgroundColor: theme.colors.surface }]}>
            {cartItems.map((item, index) => (
              <React.Fragment key={item.id}>
                <View style={styles.cartItem}>
                  <View style={styles.itemInfo}>
                    <Text variant="titleMedium" style={styles.itemName}>
                      {item.name}
                    </Text>
                    <Text variant="bodyMedium" style={styles.itemDetails}>
                      {item.dosage} • {item.quantity.unit}
                    </Text>
                  </View>
                  
                  <View style={styles.quantityContainer}>
                    <IconButton
                      icon="minus"
                      size={20}
                      onPress={() => updateQuantity(item.id, -1)}
                      disabled={item.orderQuantity <= 1}
                      style={styles.quantityButton}
                    />
                    <Text variant="titleMedium" style={styles.quantity}>
                      {item.orderQuantity}
                    </Text>
                    <IconButton
                      icon="plus"
                      size={20}
                      onPress={() => updateQuantity(item.id, 1)}
                      style={styles.quantityButton}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      onPress={() => removeItem(item.id)}
                      iconColor={theme.colors.error}
                    />
                  </View>
                </View>
                {index < cartItems.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Surface>
        ) : (
          <View style={styles.emptyCart}>
            <MaterialCommunityIcons 
              name="cart-outline" 
              size={64} 
              color={theme.colors.primary} 
              style={styles.emptyCartIcon}
            />
            <Text variant="titleMedium" style={styles.emptyCartText}>
              Your cart is empty
            </Text>
            <Button
              mode="contained"
              onPress={() => router.back()}
              style={styles.browseButton}
            >
              Browse Medicines
            </Button>
          </View>
        )}
      </ScrollView>

      {cartItems.length > 0 && (
        <Surface style={[styles.bottomBar, { backgroundColor: theme.colors.background }]} elevation={4}>
          <View style={styles.totalContainer}>
            <Text variant="titleMedium">Total Items:</Text>
            <Text variant="titleMedium" style={styles.totalItems}>
              {getTotalItems()}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={handleCheckout}
            style={styles.checkoutButton}
          >
            Proceed to Checkout
          </Button>
        </Surface>
      )}
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
  cartCount: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  cartBadge: {
    marginLeft: 4,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  cartItems: {
    margin: 16,
    borderRadius: 12,
  },
  cartItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDetails: {
    opacity: 0.7,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    margin: 0,
  },
  quantity: {
    marginHorizontal: 8,
    minWidth: 24,
    textAlign: 'center',
  },
  bottomBar: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalItems: {
    fontWeight: '600',
  },
  checkoutButton: {
    paddingVertical: 8,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyCartIcon: {
    marginBottom: 16,
    opacity: 0.7,
  },
  emptyCartText: {
    marginBottom: 24,
    opacity: 0.7,
  },
  browseButton: {
    paddingHorizontal: 32,
    paddingVertical: 8,
  },
}); 