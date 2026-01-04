import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Context for Cart and Auth
const AppContext = createContext();

const useApp = () => useContext(AppContext);

const AppProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    // Load user from localStorage
    const savedUser = localStorage.getItem('vastrakala_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    fetchCart();
  }, []);

  useEffect(() => {
    if (user) {
      fetchWishlist();
    }
  }, [user]);

  const fetchCart = async () => {
    try {
      const userId = user?.id || 'guest';
      const response = await axios.get(`${API}/cart?user_id=${userId}`);
      setCart(response.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const fetchWishlist = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API}/wishlist?user_id=${user.id}`);
      setWishlist(response.data);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const addToCart = async (item) => {
    try {
      const userId = user?.id || 'guest';
      await axios.post(`${API}/cart`, { ...item, user_id: userId });
      fetchCart();
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const updateCartItem = async (itemId, quantity) => {
    try {
      await axios.put(`${API}/cart/${itemId}`, { quantity });
      fetchCart();
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      await axios.delete(`${API}/cart/${itemId}`);
      fetchCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  const clearCart = async () => {
    try {
      const userId = user?.id || 'guest';
      await axios.delete(`${API}/cart?user_id=${userId}`);
      setCart([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  const toggleWishlist = async (productId) => {
    if (!user) {
      alert('Please login to add items to wishlist');
      return;
    }
    try {
      const isInWishlist = wishlist.some(item => item.product.id === productId);
      if (isInWishlist) {
        await axios.delete(`${API}/wishlist/${productId}?user_id=${user.id}`);
      } else {
        await axios.post(`${API}/wishlist`, { user_id: user.id, product_id: productId });
      }
      fetchWishlist();
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const login = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/google`, userData);
      const loggedInUser = response.data.user;
      setUser(loggedInUser);
      localStorage.setItem('vastrakala_user', JSON.stringify(loggedInUser));
      fetchCart();
      fetchWishlist();
      return loggedInUser;
    } catch (error) {
      console.error('Error logging in:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setWishlist([]);
    localStorage.removeItem('vastrakala_user');
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppContext.Provider value={{
      cart, cartTotal, cartCount, addToCart, updateCartItem, removeFromCart, clearCart,
      user, login, logout,
      wishlist, toggleWishlist, fetchWishlist,
      fetchCart
    }}>
      {children}
    </AppContext.Provider>
  );
};

// Header Component
const Header = () => {
  const { cartCount, user, logout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-icon">✨</span>
          <span className="logo-text">Vastrakala</span>
        </Link>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
          <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/category/sarees" onClick={() => setMenuOpen(false)}>Sarees</Link>
          <Link to="/category/dress_materials" onClick={() => setMenuOpen(false)}>Dress Materials</Link>
          <Link to="/category/readymade_dresses" onClick={() => setMenuOpen(false)}>Readymade</Link>
          <Link to="/search" onClick={() => setMenuOpen(false)}>🔍</Link>
        </nav>

        <div className="header-actions">
          {user ? (
            <div className="user-menu">
              <Link to="/profile" className="user-avatar">
                {user.picture ? <img src={user.picture} alt={user.name} /> : user.name[0]}
              </Link>
              <Link to="/wishlist" className="icon-btn">❤️</Link>
            </div>
          ) : (
            <Link to="/login" className="login-btn">Login</Link>
          )}
          <Link to="/cart" className="cart-btn">
            🛒 <span className="cart-badge">{cartCount}</span>
          </Link>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            ☰
          </button>
        </div>
      </div>
    </header>
  );
};

// Home Page
const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const [featured, newArr] = await Promise.all([
          axios.get(`${API}/products?featured=true`),
          axios.get(`${API}/products?new_arrival=true`)
        ]);
        setFeaturedProducts(featured.data);
        setNewArrivals(newArr.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const categories = [
    { name: 'Sarees', slug: 'sarees', icon: '👗', desc: 'Traditional & Designer Sarees' },
    { name: 'Dress Materials', slug: 'dress_materials', icon: '🧵', desc: 'Unstitched Suits & Fabrics' },
    { name: 'Readymade Dresses', slug: 'readymade_dresses', icon: '👘', desc: 'Kurtas, Anarkalis & More' }
  ];

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to <span className="brand">Vastrakala</span></h1>
          <p>Discover the finest collection of traditional Indian wear</p>
          <Link to="/category/sarees" className="hero-btn">Shop Now</Link>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <h2 className="section-title">Shop by Category</h2>
        <div className="categories-grid">
          {categories.map(cat => (
            <Link to={`/category/${cat.slug}`} key={cat.slug} className="category-card">
              <span className="category-icon">{cat.icon}</span>
              <h3>{cat.name}</h3>
              <p>{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="section">
          <h2 className="section-title">Featured Collection</h2>
          <div className="products-grid">
            {featuredProducts.slice(0, 4).map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="section">
          <h2 className="section-title">New Arrivals</h2>
          <div className="products-grid">
            {newArrivals.slice(0, 4).map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="features">
        <div className="feature">
          <span>🚚</span>
          <h4>Free Shipping</h4>
          <p>On orders above ₹999</p>
        </div>
        <div className="feature">
          <span>↩️</span>
          <h4>Easy Returns</h4>
          <p>7-day return policy</p>
        </div>
        <div className="feature">
          <span>🔒</span>
          <h4>Secure Payment</h4>
          <p>100% secure checkout</p>
        </div>
        <div className="feature">
          <span>💬</span>
          <h4>24/7 Support</h4>
          <p>Dedicated customer care</p>
        </div>
      </section>
    </div>
  );
};

// Product Card Component
const ProductCard = ({ product }) => {
  const { wishlist, toggleWishlist, user } = useApp();
  const isInWishlist = wishlist.some(item => item.product?.id === product.id);

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`}>
        <div className="product-image">
          {product.main_image ? (
            <img src={product.main_image} alt={product.name} />
          ) : (
            <div className="placeholder-image">
              <span>{product.category === 'sarees' ? '👗' : product.category === 'dress_materials' ? '🧵' : '👘'}</span>
            </div>
          )}
          {product.is_new_arrival && <span className="badge new">New</span>}
          {product.original_price && <span className="badge sale">Sale</span>}
        </div>
        <div className="product-info">
          <h3>{product.name}</h3>
          <p className="product-fabric">{product.fabric}</p>
          <div className="product-price">
            <span className="current-price">₹{product.price.toLocaleString()}</span>
            {product.original_price && (
              <span className="original-price">₹{product.original_price.toLocaleString()}</span>
            )}
          </div>
          {product.variants && product.variants.length > 0 && (
            <div className="color-options">
              {product.variants.slice(0, 4).map((v, i) => (
                <span key={i} className="color-dot" style={{ backgroundColor: v.color_code }} title={v.color}></span>
              ))}
            </div>
          )}
        </div>
      </Link>
      <button 
        className={`wishlist-btn ${isInWishlist ? 'active' : ''}`} 
        onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
      >
        {isInWishlist ? '❤️' : '🤍'}
      </button>
    </div>
  );
};

// Category Page
const CategoryPage = () => {
  const { name } = useParams();
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ fabric: '', occasion: '', sort: '' });
  const [filterOptions, setFilterOptions] = useState({ fabrics: [], occasions: [] });
  const [loading, setLoading] = useState(true);

  const categoryNames = {
    sarees: 'Sarees',
    dress_materials: 'Dress Materials',
    readymade_dresses: 'Readymade Dresses'
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ category: name });
        if (filters.fabric) params.append('fabric', filters.fabric);
        if (filters.occasion) params.append('occasion', filters.occasion);
        if (filters.sort) params.append('sort_by', filters.sort);

        const [productsRes, filtersRes] = await Promise.all([
          axios.get(`${API}/products?${params}`),
          axios.get(`${API}/products/filters`)
        ]);
        setProducts(productsRes.data);
        setFilterOptions(filtersRes.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [name, filters]);

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>{categoryNames[name] || name}</h1>
        <p>{products.length} Products</p>
      </div>

      <div className="filters-bar">
        <select value={filters.fabric} onChange={(e) => setFilters({ ...filters, fabric: e.target.value })}>
          <option value="">All Fabrics</option>
          {filterOptions.fabrics.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filters.occasion} onChange={(e) => setFilters({ ...filters, occasion: e.target.value })}>
          <option value="">All Occasions</option>
          {filterOptions.occasions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
          <option value="">Sort By</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="newest">Newest First</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">No products found</div>
      ) : (
        <div className="products-grid">
          {products.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
};

// Product Detail Page
const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlist } = useApp();
  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  const isInWishlist = wishlist.some(item => item.product?.id === id);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(`${API}/products/${id}`);
        setProduct(response.data);
        if (response.data.sizes?.length) setSelectedSize(response.data.sizes[0]);
        if (response.data.variants?.length) setSelectedColor(response.data.variants[0].color);
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!selectedSize || !selectedColor) {
      alert('Please select size and color');
      return;
    }
    addToCart({
      product_id: product.id,
      product_name: product.name,
      product_image: product.main_image || '',
      price: product.price,
      size: selectedSize,
      color: selectedColor,
      quantity
    });
    alert('Added to cart!');
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!product) return <div className="error">Product not found</div>;

  return (
    <div className="product-detail">
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      
      <div className="product-detail-grid">
        <div className="product-gallery">
          {product.main_image ? (
            <img src={product.main_image} alt={product.name} className="main-image" />
          ) : (
            <div className="placeholder-image large">
              <span>{product.category === 'sarees' ? '👗' : product.category === 'dress_materials' ? '🧵' : '👘'}</span>
            </div>
          )}
        </div>

        <div className="product-details">
          <h1>{product.name}</h1>
          
          <div className="price-section">
            <span className="current-price">₹{product.price.toLocaleString()}</span>
            {product.original_price && (
              <>
                <span className="original-price">₹{product.original_price.toLocaleString()}</span>
                <span className="discount">
                  {Math.round((1 - product.price / product.original_price) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          <p className="description">{product.description}</p>

          <div className="product-meta">
            {product.fabric && <p><strong>Fabric:</strong> {product.fabric}</p>}
            {product.occasion && <p><strong>Occasion:</strong> {product.occasion}</p>}
          </div>

          {/* Color Selection */}
          {product.variants && product.variants.length > 0 && (
            <div className="option-section">
              <label>Color: <strong>{selectedColor}</strong></label>
              <div className="color-options large">
                {product.variants.map((v, i) => (
                  <button
                    key={i}
                    className={`color-btn ${selectedColor === v.color ? 'selected' : ''}`}
                    style={{ backgroundColor: v.color_code }}
                    onClick={() => setSelectedColor(v.color)}
                    title={v.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="option-section">
              <label>Size:</label>
              <div className="size-options">
                {product.sizes.map(size => (
                  <button
                    key={size}
                    className={`size-btn ${selectedSize === size ? 'selected' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="option-section">
            <label>Quantity:</label>
            <div className="quantity-selector">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
          </div>

          {/* Actions */}
          <div className="action-buttons">
            <button className="add-to-cart-btn" onClick={handleAddToCart}>
              🛒 Add to Cart
            </button>
            <button 
              className={`wishlist-btn-large ${isInWishlist ? 'active' : ''}`}
              onClick={() => toggleWishlist(product.id)}
            >
              {isInWishlist ? '❤️ In Wishlist' : '🤍 Add to Wishlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Cart Page
const CartPage = () => {
  const { cart, cartTotal, updateCartItem, removeFromCart } = useApp();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="empty-cart">
        <h2>Your cart is empty</h2>
        <p>Add some beautiful items to your cart!</p>
        <Link to="/" className="continue-shopping">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>
      
      <div className="cart-container">
        <div className="cart-items">
          {cart.map(item => (
            <div key={item.id} className="cart-item">
              <div className="item-image">
                {item.product_image ? (
                  <img src={item.product_image} alt={item.product_name} />
                ) : (
                  <div className="placeholder-small">👗</div>
                )}
              </div>
              <div className="item-details">
                <h3>{item.product_name}</h3>
                <p>Size: {item.size} | Color: {item.color}</p>
                <p className="item-price">₹{item.price.toLocaleString()}</p>
              </div>
              <div className="item-quantity">
                <button onClick={() => updateCartItem(item.id, Math.max(1, item.quantity - 1))}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateCartItem(item.id, item.quantity + 1)}>+</button>
              </div>
              <div className="item-total">
                ₹{(item.price * item.quantity).toLocaleString()}
              </div>
              <button className="remove-btn" onClick={() => removeFromCart(item.id)}>✕</button>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{cartTotal.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{cartTotal >= 999 ? 'FREE' : '₹99'}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>₹{(cartTotal + (cartTotal >= 999 ? 0 : 99)).toLocaleString()}</span>
          </div>
          <button className="checkout-btn" onClick={() => navigate('/checkout')}>
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

// Checkout Page
const CheckoutPage = () => {
  const { cart, cartTotal, user, clearCart } = useApp();
  const navigate = useNavigate();
  const [address, setAddress] = useState({
    name: user?.name || '',
    phone: '',
    street: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [processing, setProcessing] = useState(false);

  const shipping = cartTotal >= 999 ? 0 : 99;
  const total = cartTotal + shipping;

  const handlePlaceOrder = async () => {
    if (!address.name || !address.phone || !address.street || !address.city || !address.pincode) {
      alert('Please fill all address fields');
      return;
    }

    setProcessing(true);
    try {
      // Create order
      const orderData = {
        user_id: user?.id || 'guest',
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          size: item.size,
          color: item.color,
          quantity: item.quantity
        })),
        subtotal: cartTotal,
        shipping,
        total,
        shipping_address: address
      };

      const orderRes = await axios.post(`${API}/orders`, orderData);
      const order = orderRes.data;

      // Create mock payment
      const paymentRes = await axios.post(`${API}/payment/create?order_id=${order.id}&amount=${total}`);
      
      // Verify payment (mock)
      await axios.post(`${API}/payment/verify`, {
        order_id: order.id,
        payment_id: `pay_${Date.now()}`,
        signature: 'mock_signature'
      });

      alert('Order placed successfully!');
      navigate(`/order/${order.id}`);
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="empty-cart">
        <h2>Your cart is empty</h2>
        <Link to="/" className="continue-shopping">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      
      <div className="checkout-container">
        <div className="address-form">
          <h3>Shipping Address</h3>
          <input
            type="text"
            placeholder="Full Name"
            value={address.name}
            onChange={(e) => setAddress({ ...address, name: e.target.value })}
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={address.phone}
            onChange={(e) => setAddress({ ...address, phone: e.target.value })}
          />
          <textarea
            placeholder="Street Address"
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
          <div className="address-row">
            <input
              type="text"
              placeholder="City"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
            <input
              type="text"
              placeholder="State"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
            />
          </div>
          <input
            type="text"
            placeholder="PIN Code"
            value={address.pincode}
            onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
          />
        </div>

        <div className="order-summary">
          <h3>Order Summary</h3>
          {cart.map(item => (
            <div key={item.id} className="summary-item">
              <span>{item.product_name} x {item.quantity}</span>
              <span>₹{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{cartTotal.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{shipping === 0 ? 'FREE' : `₹${shipping}`}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
          <button 
            className="place-order-btn" 
            onClick={handlePlaceOrder}
            disabled={processing}
          >
            {processing ? 'Processing...' : `Pay ₹${total.toLocaleString()}`}
          </button>
          <p className="mock-notice">⚠️ This is a demo. No real payment will be processed.</p>
        </div>
      </div>
    </div>
  );
};

// Search Page
const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/products?search=${encodeURIComponent(query)}`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-page">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search for sarees, suits, dresses..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit">🔍 Search</button>
      </form>

      {loading ? (
        <div className="loading">Searching...</div>
      ) : products.length > 0 ? (
        <>
          <p className="search-results-count">{products.length} results for "{query}"</p>
          <div className="products-grid">
            {products.map(product => <ProductCard key={product.id} product={product} />)}
          </div>
        </>
      ) : query && (
        <div className="empty-state">No products found for "{query}"</div>
      )}
    </div>
  );
};

// Wishlist Page
const WishlistPage = () => {
  const { wishlist, toggleWishlist, user } = useApp();

  if (!user) {
    return (
      <div className="empty-state">
        <h2>Please login to view your wishlist</h2>
        <Link to="/login" className="login-btn">Login</Link>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your wishlist is empty</h2>
        <p>Save your favorite items here!</p>
        <Link to="/" className="continue-shopping">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <h1>My Wishlist ({wishlist.length})</h1>
      <div className="products-grid">
        {wishlist.map(item => (
          <ProductCard key={item.product.id} product={item.product} />
        ))}
      </div>
    </div>
  );
};

// Login Page
const LoginPage = () => {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !name) {
      alert('Please enter name and email');
      return;
    }
    await login({
      email,
      name,
      google_id: `demo_${Date.now()}`,
      picture: null
    });
    navigate('/');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Welcome to Vastrakala</h1>
        <p>Sign in to continue shopping</p>
        
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="login-submit">Sign In</button>
        </form>
        
        <p className="demo-note">Demo login - Enter any name and email</p>
      </div>
    </div>
  );
};

// Profile Page
const ProfilePage = () => {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">
          {user.picture ? <img src={user.picture} alt={user.name} /> : user.name[0]}
        </div>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        
        <div className="profile-links">
          <Link to="/orders">📦 My Orders</Link>
          <Link to="/wishlist">❤️ Wishlist</Link>
        </div>
        
        <button className="logout-btn" onClick={() => { logout(); navigate('/'); }}>
          Logout
        </button>
      </div>
    </div>
  );
};

// Orders Page
const OrdersPage = () => {
  const { user } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const response = await axios.get(`${API}/orders?user_id=${user.id}`);
        setOrders(response.data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <div className="empty-state">
        <h2>Please login to view your orders</h2>
        <Link to="/login" className="login-btn">Login</Link>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading orders...</div>;

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <h2>No orders yet</h2>
        <p>Start shopping to see your orders here!</p>
        <Link to="/" className="continue-shopping">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1>My Orders</h1>
      <div className="orders-list">
        {orders.map(order => (
          <Link to={`/order/${order.id}`} key={order.id} className="order-card">
            <div className="order-header">
              <span className="order-id">Order #{order.id.slice(0, 8)}</span>
              <span className={`order-status ${order.order_status}`}>{order.order_status}</span>
            </div>
            <div className="order-items">
              {order.items.map((item, i) => (
                <span key={i}>{item.product_name} x{item.quantity}</span>
              ))}
            </div>
            <div className="order-footer">
              <span>₹{order.total.toLocaleString()}</span>
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Order Detail Page
const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const [orderRes, trackingRes] = await Promise.all([
          axios.get(`${API}/orders/${id}`),
          axios.get(`${API}/orders/${id}/tracking`)
        ]);
        setOrder(orderRes.data);
        setTracking(trackingRes.data.tracking || []);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) return <div className="loading">Loading order...</div>;
  if (!order) return <div className="error">Order not found</div>;

  return (
    <div className="order-detail-page">
      <h1>Order #{order.id.slice(0, 8)}</h1>
      
      <div className="order-detail-grid">
        <div className="order-info">
          <div className="info-section">
            <h3>Order Status</h3>
            <span className={`status-badge ${order.order_status}`}>{order.order_status}</span>
          </div>

          <div className="info-section">
            <h3>Items</h3>
            {order.items.map((item, i) => (
              <div key={i} className="order-item">
                <span>{item.product_name}</span>
                <span>{item.size} / {item.color}</span>
                <span>x{item.quantity}</span>
                <span>₹{item.price.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="info-section">
            <h3>Payment</h3>
            <p>Subtotal: ₹{order.subtotal.toLocaleString()}</p>
            <p>Shipping: ₹{order.shipping.toLocaleString()}</p>
            <p><strong>Total: ₹{order.total.toLocaleString()}</strong></p>
            <p>Status: <span className={`payment-status ${order.payment_status}`}>{order.payment_status}</span></p>
          </div>

          {order.shipping_address && (
            <div className="info-section">
              <h3>Shipping Address</h3>
              <p>{order.shipping_address.name}</p>
              <p>{order.shipping_address.street}</p>
              <p>{order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}</p>
              <p>Phone: {order.shipping_address.phone}</p>
            </div>
          )}
        </div>

        <div className="tracking-section">
          <h3>Tracking</h3>
          <div className="tracking-timeline">
            {tracking.map((t, i) => (
              <div key={i} className={`tracking-item ${i === tracking.length - 1 ? 'current' : ''}`}>
                <div className="tracking-dot"></div>
                <div className="tracking-content">
                  <h4>{t.status}</h4>
                  <p>{t.message}</p>
                  {t.location && <p className="location">📍 {t.location}</p>}
                  <span className="timestamp">{new Date(t.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Pages
const AdminDashboard = () => {
  const [stats, setStats] = useState({ products: 0, orders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [productsRes, ordersRes] = await Promise.all([
          axios.get(`${API}/products`),
          axios.get(`${API}/admin/orders`)
        ]);
        setStats({
          products: productsRes.data.length,
          orders: ordersRes.data.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <Link to="/" className="back-to-store">← Back to Store</Link>
      </div>

      <div className="admin-nav">
        <Link to="/admin" className="active">Dashboard</Link>
        <Link to="/admin/products">Products</Link>
        <Link to="/admin/orders">Orders</Link>
        <Link to="/admin/add-product">Add Product</Link>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Products</h3>
            <span className="stat-value">{stats.products}</span>
          </div>
          <div className="stat-card">
            <h3>Total Orders</h3>
            <span className="stat-value">{stats.orders}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Manage Products</h1>
        <Link to="/" className="back-to-store">← Back to Store</Link>
      </div>

      <div className="admin-nav">
        <Link to="/admin">Dashboard</Link>
        <Link to="/admin/products" className="active">Products</Link>
        <Link to="/admin/orders">Orders</Link>
        <Link to="/admin/add-product">Add Product</Link>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Fabric</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>₹{product.price.toLocaleString()}</td>
                  <td>{product.fabric}</td>
                  <td>
                    <button className="delete-btn" onClick={() => deleteProduct(product.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/admin/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.post(`${API}/orders/${orderId}/tracking`, { status });
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Manage Orders</h1>
        <Link to="/" className="back-to-store">← Back to Store</Link>
      </div>

      <div className="admin-nav">
        <Link to="/admin">Dashboard</Link>
        <Link to="/admin/products">Products</Link>
        <Link to="/admin/orders" className="active">Orders</Link>
        <Link to="/admin/add-product">Add Product</Link>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">No orders yet</div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>{order.id.slice(0, 8)}</td>
                  <td>{order.items.length} items</td>
                  <td>₹{order.total.toLocaleString()}</td>
                  <td><span className={`status-badge ${order.order_status}`}>{order.order_status}</span></td>
                  <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>
                    <select 
                      value={order.order_status} 
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="packed">Packed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AdminAddProduct = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    category: 'sarees',
    fabric: '',
    occasion: '',
    main_image: '',
    is_featured: false,
    is_new_arrival: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/products`, {
        ...product,
        price: parseFloat(product.price),
        original_price: product.original_price ? parseFloat(product.original_price) : null
      });
      alert('Product added successfully!');
      navigate('/admin/products');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Add Product</h1>
        <Link to="/" className="back-to-store">← Back to Store</Link>
      </div>

      <div className="admin-nav">
        <Link to="/admin">Dashboard</Link>
        <Link to="/admin/products">Products</Link>
        <Link to="/admin/orders">Orders</Link>
        <Link to="/admin/add-product" className="active">Add Product</Link>
      </div>

      <form onSubmit={handleSubmit} className="add-product-form">
        <input
          type="text"
          placeholder="Product Name"
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
          required
        />
        <textarea
          placeholder="Description"
          value={product.description}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
          required
        />
        <div className="form-row">
          <input
            type="number"
            placeholder="Price (₹)"
            value={product.price}
            onChange={(e) => setProduct({ ...product, price: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Original Price (₹)"
            value={product.original_price}
            onChange={(e) => setProduct({ ...product, original_price: e.target.value })}
          />
        </div>
        <select
          value={product.category}
          onChange={(e) => setProduct({ ...product, category: e.target.value })}
        >
          <option value="sarees">Sarees</option>
          <option value="dress_materials">Dress Materials</option>
          <option value="readymade_dresses">Readymade Dresses</option>
        </select>
        <div className="form-row">
          <input
            type="text"
            placeholder="Fabric"
            value={product.fabric}
            onChange={(e) => setProduct({ ...product, fabric: e.target.value })}
          />
          <input
            type="text"
            placeholder="Occasion"
            value={product.occasion}
            onChange={(e) => setProduct({ ...product, occasion: e.target.value })}
          />
        </div>
        <input
          type="url"
          placeholder="Main Image URL"
          value={product.main_image}
          onChange={(e) => setProduct({ ...product, main_image: e.target.value })}
        />
        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={product.is_featured}
              onChange={(e) => setProduct({ ...product, is_featured: e.target.checked })}
            />
            Featured Product
          </label>
          <label>
            <input
              type="checkbox"
              checked={product.is_new_arrival}
              onChange={(e) => setProduct({ ...product, is_new_arrival: e.target.checked })}
            />
            New Arrival
          </label>
        </div>
        <button type="submit" className="submit-btn">Add Product</button>
      </form>
    </div>
  );
};

// Footer
const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <div className="footer-section">
        <h4>✨ Vastrakala</h4>
        <p>Your destination for beautiful Indian ethnic wear</p>
      </div>
      <div className="footer-section">
        <h4>Quick Links</h4>
        <Link to="/category/sarees">Sarees</Link>
        <Link to="/category/dress_materials">Dress Materials</Link>
        <Link to="/category/readymade_dresses">Readymade</Link>
      </div>
      <div className="footer-section">
        <h4>Customer Care</h4>
        <p>📧 support@vastrakala.com</p>
        <p>📞 +91 98765 43210</p>
      </div>
    </div>
    <div className="footer-bottom">
      <p>© 2025 Vastrakala. All rights reserved.</p>
    </div>
  </footer>
);

// Main App
function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="app">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/category/:name" element={<CategoryPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/order/:id" element={<OrderDetailPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/add-product" element={<AdminAddProduct />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
