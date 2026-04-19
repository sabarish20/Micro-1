package com.shopnative.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductDto {
    private UUID id;
    private String name;
    private String author;
    private BigDecimal price;
    /** Must match FastAPI / Pydantic JSON field name {@code stock_quantity}. */
    @JsonProperty("stock_quantity")
    private int stockQuantity;
    @JsonProperty("is_active")
    private boolean isActive;
}
