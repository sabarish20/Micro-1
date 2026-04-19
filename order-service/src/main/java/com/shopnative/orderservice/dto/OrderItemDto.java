package com.shopnative.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrderItemDto {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productAuthor;
    private BigDecimal unitPrice;
    private int quantity;
    private BigDecimal lineTotal;
}
