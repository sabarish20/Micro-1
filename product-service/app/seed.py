"""Seed initial data if the database is empty."""
from decimal import Decimal
from .database import SessionLocal
from .models import Category, Product


CATEGORIES = [
    {"name": "Programming", "description": "Software engineering and coding books"},
    {"name": "DevOps & Cloud", "description": "Infrastructure, containers, and cloud-native topics"},
    {"name": "Architecture", "description": "System design and software architecture"},
    {"name": "Data Science", "description": "Machine learning, AI, and data engineering"},
]

PRODUCTS = [
    {
        "name": "Clean Code",
        "author": "Robert C. Martin",
        "description": "A handbook of agile software craftsmanship. Packed with practical advice on writing clean, readable code.",
        "price": Decimal("34.99"),
        "stock_quantity": 50,
        "isbn": "978-0132350884",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/41SH-SvWPxL._SX374_BO1,204,203,200_.jpg",
        "category_name": "Programming",
    },
    {
        "name": "The Pragmatic Programmer",
        "author": "Andrew Hunt & David Thomas",
        "description": "Your journey to mastery. From journeyman to master, this book covers the essence of great software development.",
        "price": Decimal("39.99"),
        "stock_quantity": 35,
        "isbn": "978-0135957059",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/41as+WafrFL._SX396_BO1,204,203,200_.jpg",
        "category_name": "Programming",
    },
    {
        "name": "Kubernetes in Action",
        "author": "Marko Lukša",
        "description": "A comprehensive guide to using Kubernetes to deploy, manage, and scale containerized applications.",
        "price": Decimal("49.99"),
        "stock_quantity": 40,
        "isbn": "978-1617293726",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/51E9YSVEGQL._SX397_BO1,204,203,200_.jpg",
        "category_name": "DevOps & Cloud",
    },
    {
        "name": "The Phoenix Project",
        "author": "Gene Kim, Kevin Behr & George Spafford",
        "description": "A novel about IT, DevOps, and helping your business win. A must-read for any DevOps practitioner.",
        "price": Decimal("24.99"),
        "stock_quantity": 60,
        "isbn": "978-1942788294",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/51cSFT0UQHL._SX331_BO1,204,203,200_.jpg",
        "category_name": "DevOps & Cloud",
    },
    {
        "name": "Designing Data-Intensive Applications",
        "author": "Martin Kleppmann",
        "description": "The definitive guide to the principles, techniques, and tradeoffs when building data-intensive systems.",
        "price": Decimal("54.99"),
        "stock_quantity": 30,
        "isbn": "978-1449373320",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/51ZSpMl1-LL._SX379_BO1,204,203,200_.jpg",
        "category_name": "Architecture",
    },
    {
        "name": "Building Microservices",
        "author": "Sam Newman",
        "description": "Designing fine-grained systems. Covers service decomposition, communication patterns, and deployment strategies.",
        "price": Decimal("49.99"),
        "stock_quantity": 45,
        "isbn": "978-1492034025",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/51h2tXNnFRL._SX379_BO1,204,203,200_.jpg",
        "category_name": "Architecture",
    },
    {
        "name": "Site Reliability Engineering",
        "author": "Betsy Beyer, Chris Jones & Jennifer Petoff",
        "description": "How Google runs production systems. The definitive reference for SRE practices and principles.",
        "price": Decimal("44.99"),
        "stock_quantity": 25,
        "isbn": "978-1491929124",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/51DLME6U6EL._SX379_BO1,204,203,200_.jpg",
        "category_name": "DevOps & Cloud",
    },
    {
        "name": "Hands-On Machine Learning",
        "author": "Aurélien Géron",
        "description": "With Scikit-Learn, Keras, and TensorFlow. Practical tools and techniques for ML practitioners.",
        "price": Decimal("59.99"),
        "stock_quantity": 20,
        "isbn": "978-1492032649",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/51aqYc1QyrL._SX379_BO1,204,203,200_.jpg",
        "category_name": "Data Science",
    },
    {
        "name": "Docker Deep Dive",
        "author": "Nigel Poulton",
        "description": "A concise guide to Docker containers, images, networking and orchestration fundamentals.",
        "price": Decimal("19.99"),
        "stock_quantity": 70,
        "isbn": "978-1521822807",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/414sM8REYHL._SX379_BO1,204,203,200_.jpg",
        "category_name": "DevOps & Cloud",
    },
    {
        "name": "System Design Interview",
        "author": "Alex Xu",
        "description": "An insider's guide to system design interviews covering scalability, reliability, and real-world systems.",
        "price": Decimal("29.99"),
        "stock_quantity": 55,
        "isbn": "978-1736049112",
        "image_url": "https://images-na.ssl-images-amazon.com/images/I/41I1M5I5+sL._SX379_BO1,204,203,200_.jpg",
        "category_name": "Architecture",
    },
]


def seed_database() -> None:
    db = SessionLocal()
    try:
        if db.query(Category).count() > 0:
            return

        category_map: dict[str, Category] = {}
        for cat_data in CATEGORIES:
            cat = Category(**cat_data)
            db.add(cat)
            db.flush()
            category_map[cat.name] = cat

        for prod_data in PRODUCTS:
            category_name = prod_data.pop("category_name")
            product = Product(
                **prod_data,
                category_id=category_map[category_name].id,
            )
            db.add(product)

        db.commit()
        print("✅ Database seeded with initial products")
    except Exception as e:
        db.rollback()
        print(f"⚠️  Seeding skipped or failed: {e}")
    finally:
        db.close()
