package com.shopnative.orderservice.controller;

import com.shopnative.orderservice.dto.CreateOrderRequest;
import com.shopnative.orderservice.dto.OrderDto;
import com.shopnative.orderservice.security.AuthenticatedUser;
import com.shopnative.orderservice.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<OrderDto> createOrder(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.createOrder(user.getUserId(), request));
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> getMyOrders(
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(orderService.getUserOrders(user.getUserId()));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderDto> getOrder(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(orderService.getOrder(orderId, user.getUserId()));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<OrderDto> cancelOrder(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(orderService.cancelOrder(orderId, user.getUserId()));
    }
}
