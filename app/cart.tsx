import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Button, IconButton, Badge, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader'; // Assuming you have a shared AppHeader

// Interface for Cart Items (adapt as needed)
interface CartItem {
  id: string;
  name: string;
  details: string; // e.g., "500mg • tablets"
  quantity: number;
}

// Sample Cart Data (Replace with actual state/context)
const initialCartItems: CartItem[] = [
  {
    id: 'med1',
    name: 'Amoxicillin',
    details: '500mg • tablets',
    quantity: 1,
  },
  // Add more sample items if needed
];

export default function CartScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleQuantityChange = (id: string, change: number) => {
    setCartItems(currentItems =>
      currentItems.map(item =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + change) } // Ensure quantity doesn't go below 1
          : item
      ).filter(item => item.quantity > 0) // Optionally remove if quantity hits 0, though button stops at 1
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(currentItems => currentItems.filter(item => item.id !== id));
  };

  const calculateTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleProceedToCheckout = () => {
    console.log("Proceeding to checkout with items:", cartItems);
    // Navigate to checkout screen (replace with actual route)
    // router.push('/checkout'); 
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader 
        title="Cart"
        leftIcon="arrow-left"
        onLeftPress={() => router.back()} // Go back action
        rightIcon="cart-outline" // Optional: Keep cart icon
        rightIconBadge={calculateTotalItems() > 0 ? calculateTotalItems() : undefined}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cartItems.length === 0 ? (
          <View style={styles.emptyCartContainer}>
            <Text style={styles.emptyCartText}>Your cart is empty.</Text>
          </View>
        ) : (
          cartItems.map(item => (
            <View key={item.id} style={styles.cartItemContainer}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDetails}>{item.details}</Text>
              </View>
              <View style={styles.itemActions}>
                <IconButton
                  icon="minus" 
                  size={18}
                  onPress={() => handleQuantityChange(item.id, -1)}
                  disabled={item.quantity <= 1}
                  style={styles.quantityButton}
                />
                <Text style={styles.itemQuantity}>{item.quantity}</Text>
                <IconButton
                  icon="plus"
                  size={18}
                  onPress={() => handleQuantityChange(item.id, 1)}
                  style={styles.quantityButton}
                />
                <IconButton
                  icon="delete-outline"
                  size={20}
                  iconColor={theme.colors.error}
                  onPress={() => handleRemoveItem(item.id)}
                  style={styles.deleteButton}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <Divider style={styles.footerDivider} />
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Items:</Text>
            <Text style={styles.totalValue}>{calculateTotalItems()}</Text>
          </View>
          <Button
            mode="contained"
            onPress={handleProceedToCheckout}
            style={styles.checkoutButton}
            labelStyle={styles.checkoutButtonLabel}
            contentStyle={styles.checkoutButtonContent}
            theme={{ roundness: 25 }}
          >
            Proceed to Checkout
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 18,
    color: theme.colors.onSurfaceVariant,
  },
  cartItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    margin: 0,
    backgroundColor: theme.colors.surfaceVariant, // Subtle background for buttons
  },
  itemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
    minWidth: 20, // Ensure space for quantity
    textAlign: 'center',
  },
  deleteButton: {
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    paddingBottom: 24, // Extra padding at bottom
    backgroundColor: theme.colors.surface, // Footer background
    borderTopWidth: 1,
    borderTopColor: theme.colors.outlineVariant,
  },
  footerDivider: {
    marginBottom: 16, 
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutButton: {
    elevation: 2,
  },
  checkoutButtonLabel: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  checkoutButtonContent: {
    paddingVertical: 8,
  },
}); 