import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Product, Category
from ..schemas import PaginatedProducts, ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=PaginatedProducts)
def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=100),
    category_id: Optional[UUID] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.is_active == True)
    )

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if search:
        term = f"%{search}%"
        query = query.filter(
            Product.name.ilike(term) | Product.author.ilike(term)
        )

    total = query.count()
    pages = math.ceil(total / size) if total > 0 else 1
    items = query.order_by(Product.created_at.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedProducts(items=items, total=total, page=page, size=size, pages=pages)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    if payload.category_id:
        category = db.query(Category).filter(Category.id == payload.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    if payload.isbn:
        existing = db.query(Product).filter(Product.isbn == payload.isbn).first()
        if existing:
            raise HTTPException(status_code=409, detail="ISBN already registered")

    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)

    return db.query(Product).options(joinedload(Product.category)).filter(Product.id == product.id).first()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: UUID, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id == product_id, Product.is_active == True)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: UUID, payload: ProductUpdate, db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.category_id:
        category = db.query(Category).filter(Category.id == payload.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()

    return db.query(Product).options(joinedload(Product.category)).filter(Product.id == product.id).first()


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: UUID, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    db.commit()
