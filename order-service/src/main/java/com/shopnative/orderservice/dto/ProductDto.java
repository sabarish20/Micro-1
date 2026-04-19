package com.shopnative.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
    private int stockQuantity;
    private boolean isActive;
}
