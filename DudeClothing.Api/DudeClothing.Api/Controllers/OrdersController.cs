using System.Security.Claims;
using DudeClothing.Api.Models.Orders;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly OrderRepository _orderRepository;

    public OrdersController(OrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    // =========================================================
    // 1. CREATE ORDER FROM EXPLICIT ORDER ITEMS
    // POST: /api/Orders
    // =========================================================
    [HttpPost]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequest request)
    {
        if (!TryGetUserId(out int userId))
        {
            return Unauthorized();
        }

        try
        {
            var order = await _orderRepository.CreateAsync(
                userId,
                request);

            return CreatedAtAction(
                nameof(GetOrderById),
                new { id = order.OrderId },
                order);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // =========================================================
    // 2. CHECKOUT FROM THE CUSTOMER'S DATABASE CART
    // POST: /api/Orders/checkout
    // =========================================================
    [HttpPost("checkout")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> Checkout(
        [FromBody] CheckoutRequest request)
    {
        if (!TryGetUserId(out int userId))
        {
            return Unauthorized();
        }

        try
        {
            var order = await _orderRepository.CheckoutAsync(
                userId,
                request);

            return CreatedAtAction(
                nameof(GetOrderById),
                new { id = order.OrderId },
                order);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // =========================================================
    // 3. GET ORDERS
    // Admin: all orders
    // Customer: only their own orders
    // GET: /api/Orders
    // =========================================================
    [HttpGet]
    public async Task<IActionResult> GetOrders()
    {
        if (User.IsInRole("Admin"))
        {
            var allOrders =
                await _orderRepository.GetOrdersAsync();

            return Ok(allOrders);
        }

        if (!TryGetUserId(out int userId))
        {
            return Unauthorized();
        }

        var customerOrders =
            await _orderRepository.GetOrdersAsync(userId);

        return Ok(customerOrders);
    }

    // =========================================================
    // 4. GET ONE ORDER
    // GET: /api/Orders/{id}
    // =========================================================
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetOrderById(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Invalid order ID."
            });
        }

        var order = await _orderRepository.GetByIdAsync(id);

        if (order is null)
        {
            return NotFound();
        }

        if (!User.IsInRole("Admin"))
        {
            if (!TryGetUserId(out int userId))
            {
                return Unauthorized();
            }

            if (order.UserId != userId)
            {
                // Do not disclose another customer's order.
                return NotFound();
            }
        }

        return Ok(order);
    }

    // =========================================================
    // 5. UPDATE ORDER STATUS
    // Admin only
    // PATCH: /api/Orders/{id}/status
    // =========================================================
    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateOrderStatus(
        int id,
        [FromBody] UpdateOrderStatusRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new
            {
                message = "Invalid order ID."
            });
        }

        try
        {
            bool updated =
                await _orderRepository.UpdateStatusAsync(
                    id,
                    request.OrderStatus);

            if (!updated)
            {
                return NotFound(new
                {
                    message = "Order not found."
                });
            }

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
    }

    // =========================================================
    // 6. GET AUTHENTICATED USER ID FROM JWT CLAIMS
    // =========================================================
    private bool TryGetUserId(out int userId)
    {
        var value = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(value, out userId);
    }
}
