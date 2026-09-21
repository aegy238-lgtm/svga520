export type ProductType = 'License Key' | 'Account' | 'Subscription';

export interface ProductDurationOption {
  id: string;
  label: string;
  price: number;
}
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
  category: string;
  imageUrl: string;
  features: string[];
  stock: number;
  durationOptions?: ProductDurationOption[];
  discountPercentage?: number;
  isOffer?: boolean;
}
export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetProductId?: string;
  isActive: boolean;
  usageCount: number;
}
export interface PaymentMethod {
  id: string;
  name: string;
  details: string;
  isActive: boolean;
  imageUrl?: string;
}
export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export const mockProducts: Product[] = [
  {
    id: "p1",
    name: "ChatGPT Plus Shared Account",
    description: "Premium access to GPT-4. Shared account with instant delivery.",
    price: 500,
    type: "Account",
    category: "AI Tools",
    imageUrl: "https://images.unsplash.com/photo-1684497813589-399fa5180f68",
    features: ["GPT-4 Access", "DALL-E 3 Image Generation", "Advanced Data Analysis", "Instant Delivery via Email"],
    stock: 50,
    durationOptions: [
      { id: "1m", label: "1 Month", price: 500 },
      { id: "3m", label: "3 Months", price: 1250 },
      { id: "12m", label: "1 Year", price: 4000 }
    ]
  },
  {
    id: "p2",
    name: "Adobe Creative Cloud All Apps",
    description: "Private activation on your own email. Full 1-year access.",
    price: 4750,
    type: "Subscription",
    category: "Design Software",
    imageUrl: "https://images.unsplash.com/photo-1558655146-d09347e92766",
    features: ["Photoshop, Illustrator, Premiere", "100GB Cloud Storage", "Private Account Upgrade", "1 Year Warranty"],
    stock: 10
  },
  {
    id: "p3",
    name: "Windows 11 Pro OEM Key",
    description: "Genuine OEM License Key for Windows 11 Pro. Binds to your motherboard.",
    price: 750,
    type: "License Key",
    category: "Operating Systems",
    imageUrl: "https://images.unsplash.com/photo-1633419461186-7d40a38105ec",
    features: ["Lifetime Activation", "Instant Delivery", "Supports Updates", "Global Region"],
    stock: 120
  }
];

export const mockBanners = [
  { id: "b1", imageUrl: "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2832&auto=format&fit=crop", isActive: true },
  { id: "b2", imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2748&auto=format&fit=crop", isActive: true }
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm1", name: "Vodafone Cash", details: "01000000000", isActive: true },
  { id: "pm2", name: "PayPal", details: "admin@keymaster.com", isActive: true }
];
