from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class ProductVariant(BaseModel):
    color: str
    color_code: str
    images: List[str] = []

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    original_price: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    sizes: List[str] = ["S", "M", "L", "XL"]
    variants: List[ProductVariant] = []
    main_image: str = ""
    fabric: Optional[str] = None
    occasion: Optional[str] = None
    is_featured: bool = False
    is_new_arrival: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    original_price: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    sizes: List[str] = ["S", "M", "L", "XL"]
    variants: List[ProductVariant] = []
    main_image: str = ""
    fabric: Optional[str] = None
    occasion: Optional[str] = None
    is_featured: bool = False
    is_new_arrival: bool = False

class CartItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = "guest"
    product_id: str
    product_name: str
    product_image: str
    price: float
    size: str
    color: str
    quantity: int = 1
    added_at: datetime = Field(default_factory=datetime.utcnow)

class CartItemCreate(BaseModel):
    user_id: str = "guest"
    product_id: str
    product_name: str
    product_image: str
    price: float
    size: str
    color: str
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

# Wishlist Models
class WishlistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    added_at: datetime = Field(default_factory=datetime.utcnow)

class WishlistItemCreate(BaseModel):
    user_id: str
    product_id: str

# User Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "google"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    google_id: str

# Order Models
class OrderItem(BaseModel):
    product_id: str
    product_name: str
    price: float
    size: str
    color: str
    quantity: int

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[OrderItem]
    subtotal: float
    shipping: float
    total: float
    payment_id: Optional[str] = None
    payment_status: str = "pending"  # pending, completed, failed
    order_status: str = "pending"  # pending, confirmed, shipped, delivered
    shipping_address: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CreateOrderRequest(BaseModel):
    user_id: str
    items: List[OrderItem]
    subtotal: float
    shipping: float
    total: float
    shipping_address: Optional[dict] = None

class PaymentVerifyRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str

# Routes
@api_router.get("/")
async def root():
    return {"message": "Welcome to Vastrakala API"}

# Product Routes with Search and Filters
@api_router.get("/products", response_model=List[Product])
async def get_products(
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    new_arrival: Optional[bool] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    fabric: Optional[str] = None,
    occasion: Optional[str] = None,
    sort_by: Optional[str] = None  # price_asc, price_desc, newest
):
    query = {}
    
    if category:
        query["category"] = category
    if featured is not None:
        query["is_featured"] = featured
    if new_arrival is not None:
        query["is_new_arrival"] = new_arrival
    if fabric:
        query["fabric"] = {"$regex": fabric, "$options": "i"}
    if occasion:
        query["occasion"] = {"$regex": occasion, "$options": "i"}
    
    # Price filter
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"]["$lte"] = max_price
    
    # Search in name and description
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"fabric": {"$regex": search, "$options": "i"}},
            {"occasion": {"$regex": search, "$options": "i"}}
        ]
    
    # Sorting
    sort_options = {}
    if sort_by == "price_asc":
        sort_options = [("price", 1)]
    elif sort_by == "price_desc":
        sort_options = [("price", -1)]
    elif sort_by == "newest":
        sort_options = [("created_at", -1)]
    else:
        sort_options = [("created_at", -1)]
    
    products = await db.products.find(query).sort(sort_options).to_list(100)
    return [Product(**product) for product in products]

@api_router.get("/products/filters")
async def get_filter_options():
    """Get available filter options"""
    fabrics = await db.products.distinct("fabric")
    occasions = await db.products.distinct("occasion")
    
    # Get price range
    pipeline = [
        {"$group": {
            "_id": None,
            "min_price": {"$min": "$price"},
            "max_price": {"$max": "$price"}
        }}
    ]
    price_range = await db.products.aggregate(pipeline).to_list(1)
    
    return {
        "fabrics": [f for f in fabrics if f],
        "occasions": [o for o in occasions if o],
        "price_range": price_range[0] if price_range else {"min_price": 0, "max_price": 50000}
    }

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate):
    product_dict = product.dict()
    product_obj = Product(**product_dict)
    await db.products.insert_one(product_obj.dict())
    return product_obj

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# Cart Routes
@api_router.get("/cart", response_model=List[CartItem])
async def get_cart(user_id: str = "guest"):
    items = await db.cart.find({"user_id": user_id}).to_list(100)
    return [CartItem(**item) for item in items]

@api_router.post("/cart", response_model=CartItem)
async def add_to_cart(item: CartItemCreate):
    existing = await db.cart.find_one({
        "user_id": item.user_id,
        "product_id": item.product_id,
        "size": item.size,
        "color": item.color
    })
    
    if existing:
        new_quantity = existing["quantity"] + item.quantity
        await db.cart.update_one(
            {"id": existing["id"]},
            {"$set": {"quantity": new_quantity}}
        )
        existing["quantity"] = new_quantity
        return CartItem(**existing)
    
    item_dict = item.dict()
    item_obj = CartItem(**item_dict)
    await db.cart.insert_one(item_obj.dict())
    return item_obj

@api_router.put("/cart/{item_id}", response_model=CartItem)
async def update_cart_item(item_id: str, update: CartItemUpdate):
    result = await db.cart.find_one_and_update(
        {"id": item_id},
        {"$set": {"quantity": update.quantity}},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return CartItem(**result)

@api_router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: str):
    result = await db.cart.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"message": "Item removed from cart"}

@api_router.delete("/cart")
async def clear_cart(user_id: str = "guest"):
    await db.cart.delete_many({"user_id": user_id})
    return {"message": "Cart cleared"}

# Wishlist Routes
@api_router.get("/wishlist", response_model=List[dict])
async def get_wishlist(user_id: str):
    wishlist_items = await db.wishlist.find({"user_id": user_id}).to_list(100)
    
    # Get product details for each wishlist item
    result = []
    for item in wishlist_items:
        product = await db.products.find_one({"id": item["product_id"]})
        if product:
            result.append({
                "wishlist_id": item["id"],
                "product": Product(**product).dict(),
                "added_at": item["added_at"]
            })
    
    return result

@api_router.post("/wishlist", response_model=WishlistItem)
async def add_to_wishlist(item: WishlistItemCreate):
    # Check if already in wishlist
    existing = await db.wishlist.find_one({
        "user_id": item.user_id,
        "product_id": item.product_id
    })
    
    if existing:
        return WishlistItem(**existing)
    
    item_dict = item.dict()
    item_obj = WishlistItem(**item_dict)
    await db.wishlist.insert_one(item_obj.dict())
    return item_obj

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, user_id: str):
    result = await db.wishlist.delete_one({
        "user_id": user_id,
        "product_id": product_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    return {"message": "Item removed from wishlist"}

@api_router.get("/wishlist/check/{product_id}")
async def check_wishlist(product_id: str, user_id: str):
    item = await db.wishlist.find_one({
        "user_id": user_id,
        "product_id": product_id
    })
    return {"in_wishlist": item is not None}

# Auth Routes
@api_router.post("/auth/google")
async def google_auth(auth_data: GoogleAuthRequest):
    """Handle Google OAuth login/signup"""
    # Check if user exists
    existing_user = await db.users.find_one({"email": auth_data.email})
    
    if existing_user:
        return {
            "user": User(**existing_user).dict(),
            "is_new": False
        }
    
    # Create new user
    user = User(
        email=auth_data.email,
        name=auth_data.name,
        picture=auth_data.picture,
        auth_provider="google"
    )
    await db.users.insert_one(user.dict())
    
    return {
        "user": user.dict(),
        "is_new": True
    }

@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

# Order Tracking Model
class OrderTracking(BaseModel):
    status: str
    message: str
    timestamp: datetime
    location: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None
    location: Optional[str] = None

# Order & Payment Routes (MOCK Razorpay)
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: CreateOrderRequest):
    """Create a new order"""
    order = Order(
        user_id=order_data.user_id,
        items=order_data.items,
        subtotal=order_data.subtotal,
        shipping=order_data.shipping,
        total=order_data.total,
        shipping_address=order_data.shipping_address
    )
    await db.orders.insert_one(order.dict())
    
    # Create initial tracking entry
    tracking_entry = {
        "order_id": order.id,
        "tracking": [
            {
                "status": "pending",
                "message": "Order placed successfully",
                "timestamp": datetime.utcnow(),
                "location": None
            }
        ]
    }
    await db.order_tracking.insert_one(tracking_entry)
    
    return order

@api_router.post("/payment/create")
async def create_payment(order_id: str, amount: float):
    """MOCK: Create Razorpay order - Returns mock payment details"""
    # In real implementation, this would call Razorpay API
    mock_razorpay_order_id = f"order_{secrets.token_hex(8)}"
    
    return {
        "razorpay_order_id": mock_razorpay_order_id,
        "amount": int(amount * 100),  # Razorpay uses paise
        "currency": "INR",
        "key_id": "rzp_test_mock_key",  # Mock key
        "order_id": order_id,
        "mock_mode": True,
        "message": "This is MOCK mode. Add real Razorpay keys for production."
    }

@api_router.post("/payment/verify")
async def verify_payment(data: PaymentVerifyRequest):
    """MOCK: Verify payment - Always succeeds in mock mode"""
    # Update order status
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {
            "payment_id": data.payment_id,
            "payment_status": "completed",
            "order_status": "confirmed"
        }}
    )
    
    # Clear user's cart
    order = await db.orders.find_one({"id": data.order_id})
    if order:
        await db.cart.delete_many({"user_id": order["user_id"]})
    
    return {
        "success": True,
        "message": "Payment verified successfully (MOCK MODE)",
        "order_id": data.order_id
    }

@api_router.get("/orders", response_model=List[Order])
async def get_orders(user_id: str):
    orders = await db.orders.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    return [Order(**order) for order in orders]

# Admin route to get all orders
@api_router.get("/admin/orders", response_model=List[Order])
async def get_all_orders():
    """Admin: Get all orders"""
    orders = await db.orders.find().sort("created_at", -1).to_list(100)
    return [Order(**order) for order in orders]

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**order)

# Order Tracking Routes
@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    """Get tracking history for an order"""
    tracking = await db.order_tracking.find_one({"order_id": order_id})
    if not tracking:
        return {"order_id": order_id, "tracking": []}
    return {"order_id": order_id, "tracking": tracking.get("tracking", [])}

@api_router.post("/orders/{order_id}/tracking")
async def update_order_tracking(order_id: str, update: OrderStatusUpdate):
    """Add a new tracking update to an order"""
    # Verify order exists
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Default messages for each status
    status_messages = {
        "pending": "Order placed successfully",
        "confirmed": "Order confirmed and being processed",
        "packed": "Order has been packed and ready for dispatch",
        "shipped": "Order has been shipped",
        "in_transit": "Order is in transit",
        "out_for_delivery": "Order is out for delivery",
        "delivered": "Order has been delivered successfully"
    }
    
    new_tracking = {
        "status": update.status,
        "message": update.message or status_messages.get(update.status, f"Status updated to {update.status}"),
        "timestamp": datetime.utcnow(),
        "location": update.location
    }
    
    # Update tracking collection
    await db.order_tracking.update_one(
        {"order_id": order_id},
        {"$push": {"tracking": new_tracking}},
        upsert=True
    )
    
    # Update order status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": update.status}}
    )
    
    return {"success": True, "tracking": new_tracking}

@api_router.post("/orders/{order_id}/simulate-delivery")
async def simulate_order_delivery(order_id: str):
    """Simulate the full delivery process for testing"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Simulate delivery timeline
    tracking_updates = [
        {"status": "confirmed", "message": "Order confirmed and being processed", "location": "Warehouse"},
        {"status": "packed", "message": "Order has been packed", "location": "Warehouse"},
        {"status": "shipped", "message": "Order dispatched via courier", "location": "Shipping Hub"},
        {"status": "in_transit", "message": "Package in transit", "location": "Distribution Center"},
        {"status": "out_for_delivery", "message": "Out for delivery", "location": order.get("shipping_address", {}).get("city", "Your City")},
        {"status": "delivered", "message": "Package delivered successfully", "location": order.get("shipping_address", {}).get("city", "Your City")}
    ]
    
    # Add all tracking updates
    for i, update in enumerate(tracking_updates):
        tracking_entry = {
            "status": update["status"],
            "message": update["message"],
            "timestamp": datetime.utcnow(),
            "location": update["location"]
        }
        await db.order_tracking.update_one(
            {"order_id": order_id},
            {"$push": {"tracking": tracking_entry}},
            upsert=True
        )
    
    # Update final order status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": "delivered"}}
    )
    
    return {"success": True, "message": "Delivery simulation complete", "final_status": "delivered"}

# Seed sample products
@api_router.post("/seed")
async def seed_products():
    count = await db.products.count_documents({})
    if count > 0:
        return {"message": f"Products already seeded. {count} products exist."}
    
    sample_products = [
        # Sarees
        {
            "name": "Banarasi Silk Saree",
            "description": "Exquisite Banarasi silk saree with intricate gold zari work. Perfect for weddings and festive occasions.",
            "price": 12999,
            "original_price": 15999,
            "category": "sarees",
            "subcategory": "silk",
            "sizes": ["Free Size"],
            "variants": [
                {"color": "Maroon", "color_code": "#800000", "images": []},
                {"color": "Royal Blue", "color_code": "#4169E1", "images": []},
                {"color": "Emerald Green", "color_code": "#50C878", "images": []}
            ],
            "fabric": "Pure Silk",
            "occasion": "Wedding",
            "is_featured": True,
            "is_new_arrival": False
        },
        {
            "name": "Kanjivaram Silk Saree",
            "description": "Traditional Kanjivaram silk saree with temple border design. A timeless classic for special occasions.",
            "price": 18999,
            "original_price": 22999,
            "category": "sarees",
            "subcategory": "silk",
            "sizes": ["Free Size"],
            "variants": [
                {"color": "Red", "color_code": "#DC143C", "images": []},
                {"color": "Purple", "color_code": "#800080", "images": []}
            ],
            "fabric": "Pure Silk",
            "occasion": "Wedding",
            "is_featured": True,
            "is_new_arrival": True
        },
        {
            "name": "Chiffon Printed Saree",
            "description": "Lightweight chiffon saree with beautiful floral prints. Ideal for daily wear and casual gatherings.",
            "price": 2499,
            "original_price": 3499,
            "category": "sarees",
            "subcategory": "chiffon",
            "sizes": ["Free Size"],
            "variants": [
                {"color": "Pink", "color_code": "#FF69B4", "images": []},
                {"color": "Yellow", "color_code": "#FFD700", "images": []},
                {"color": "Peach", "color_code": "#FFDAB9", "images": []}
            ],
            "fabric": "Chiffon",
            "occasion": "Casual",
            "is_featured": False,
            "is_new_arrival": True
        },
        {
            "name": "Cotton Handloom Saree",
            "description": "Comfortable cotton handloom saree with traditional motifs. Perfect for office and daily wear.",
            "price": 1899,
            "original_price": 2499,
            "category": "sarees",
            "subcategory": "cotton",
            "sizes": ["Free Size"],
            "variants": [
                {"color": "White", "color_code": "#FFFFFF", "images": []},
                {"color": "Beige", "color_code": "#F5F5DC", "images": []}
            ],
            "fabric": "Cotton",
            "occasion": "Daily Wear",
            "is_featured": False,
            "is_new_arrival": False
        },
        # Dress Materials
        {
            "name": "Embroidered Chanderi Suit",
            "description": "Elegant Chanderi cotton suit with beautiful thread embroidery. Includes top, bottom and dupatta.",
            "price": 3999,
            "original_price": 4999,
            "category": "dress_materials",
            "subcategory": "chanderi",
            "sizes": ["Unstitched"],
            "variants": [
                {"color": "Lavender", "color_code": "#E6E6FA", "images": []},
                {"color": "Mint Green", "color_code": "#98FF98", "images": []},
                {"color": "Powder Blue", "color_code": "#B0E0E6", "images": []}
            ],
            "fabric": "Chanderi Cotton",
            "occasion": "Festive",
            "is_featured": True,
            "is_new_arrival": True
        },
        {
            "name": "Printed Lawn Suit",
            "description": "Premium lawn cotton suit with digital prints. Soft fabric perfect for summer.",
            "price": 2499,
            "original_price": 3299,
            "category": "dress_materials",
            "subcategory": "cotton",
            "sizes": ["Unstitched"],
            "variants": [
                {"color": "Coral", "color_code": "#FF7F50", "images": []},
                {"color": "Teal", "color_code": "#008080", "images": []}
            ],
            "fabric": "Lawn Cotton",
            "occasion": "Casual",
            "is_featured": False,
            "is_new_arrival": True
        },
        {
            "name": "Silk Jacquard Suit",
            "description": "Luxurious silk jacquard suit with rich texture. Perfect for weddings and parties.",
            "price": 6999,
            "original_price": 8999,
            "category": "dress_materials",
            "subcategory": "silk",
            "sizes": ["Unstitched"],
            "variants": [
                {"color": "Wine", "color_code": "#722F37", "images": []},
                {"color": "Navy Blue", "color_code": "#000080", "images": []}
            ],
            "fabric": "Silk Jacquard",
            "occasion": "Wedding",
            "is_featured": True,
            "is_new_arrival": False
        },
        # Readymade Dresses
        {
            "name": "Anarkali Gown",
            "description": "Stunning floor-length Anarkali gown with embellished bodice. Perfect for sangeet and reception.",
            "price": 8999,
            "original_price": 11999,
            "category": "readymade_dresses",
            "subcategory": "anarkali",
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "variants": [
                {"color": "Burgundy", "color_code": "#800020", "images": []},
                {"color": "Teal", "color_code": "#008080", "images": []},
                {"color": "Dusty Pink", "color_code": "#D4A5A5", "images": []}
            ],
            "fabric": "Georgette",
            "occasion": "Party",
            "is_featured": True,
            "is_new_arrival": True
        },
        {
            "name": "Palazzo Suit Set",
            "description": "Trendy kurta with palazzo pants and dupatta. Comfortable and stylish for all occasions.",
            "price": 3499,
            "original_price": 4499,
            "category": "readymade_dresses",
            "subcategory": "palazzo_set",
            "sizes": ["S", "M", "L", "XL"],
            "variants": [
                {"color": "Mustard", "color_code": "#FFDB58", "images": []},
                {"color": "Olive", "color_code": "#808000", "images": []},
                {"color": "Rust", "color_code": "#B7410E", "images": []}
            ],
            "fabric": "Rayon",
            "occasion": "Casual",
            "is_featured": False,
            "is_new_arrival": True
        },
        {
            "name": "Sharara Set",
            "description": "Elegant short kurta with flared sharara pants. Traditional yet contemporary design.",
            "price": 5999,
            "original_price": 7499,
            "category": "readymade_dresses",
            "subcategory": "sharara",
            "sizes": ["S", "M", "L", "XL"],
            "variants": [
                {"color": "Peach", "color_code": "#FFDAB9", "images": []},
                {"color": "Sage Green", "color_code": "#9DC183", "images": []}
            ],
            "fabric": "Silk Blend",
            "occasion": "Festive",
            "is_featured": True,
            "is_new_arrival": False
        },
        {
            "name": "Cotton Kurti",
            "description": "Simple and elegant cotton kurti with block print. Perfect for everyday wear.",
            "price": 999,
            "original_price": 1499,
            "category": "readymade_dresses",
            "subcategory": "kurti",
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "variants": [
                {"color": "Indigo", "color_code": "#4B0082", "images": []},
                {"color": "Maroon", "color_code": "#800000", "images": []},
                {"color": "Black", "color_code": "#000000", "images": []}
            ],
            "fabric": "Cotton",
            "occasion": "Daily Wear",
            "is_featured": False,
            "is_new_arrival": False
        },
        {
            "name": "Designer Lehenga",
            "description": "Stunning bridal lehenga with heavy embroidery and sequin work. A showstopper for your special day.",
            "price": 35999,
            "original_price": 45999,
            "category": "readymade_dresses",
            "subcategory": "lehenga",
            "sizes": ["S", "M", "L", "XL"],
            "variants": [
                {"color": "Red", "color_code": "#FF0000", "images": []},
                {"color": "Magenta", "color_code": "#FF00FF", "images": []},
                {"color": "Gold", "color_code": "#FFD700", "images": []}
            ],
            "fabric": "Velvet & Net",
            "occasion": "Bridal",
            "is_featured": True,
            "is_new_arrival": True
        }
    ]
    
    for product_data in sample_products:
        product = Product(**product_data)
        await db.products.insert_one(product.dict())
    
    return {"message": f"Successfully seeded {len(sample_products)} products"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
