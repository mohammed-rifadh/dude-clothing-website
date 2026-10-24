
using System.Security.Claims;
using DudeClothing.Api.Models.Cart;
using DudeClothing.Api.Models.Orders;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Customer")]
public class CartController : ControllerBase
{
    private readonly CartRepository _cartRepository;
    private readonly OrderRepository _orderRepository;

    public CartController(
        CartRepository cartRepository,
        OrderRepository orderRepository)
    {
        _cartRepository = cartRepository;
        _orderRepository = orderRepository;
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userIdValue, out int userId)
            ? userId
            : null;
    }

    // GET: api/Cart
    [HttpGet]
    public async Task<IActionResult> GetCart()
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        var cart = await _cartRepository.GetCartAsync(
            userId.Value);

        return Ok(cart);
    }

    // POST: api/Cart/items
    [HttpPost("items")]
    public async Task<IActionResult> AddItem(
        [FromBody] AddCartItemRequest request)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        try
        {
            var cart = await _cartRepository.AddItemAsync(
                userId.Value,
                request.VariantId,
                request.Quantity);

            return Ok(cart);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // PUT: api/Cart/items/{cartItemId}
    [HttpPut("items/{cartItemId:int}")]
    public async Task<IActionResult> UpdateItem(
        int cartItemId,
        [FromBody] UpdateCartItemRequest request)
    {
        if (cartItemId <= 0)
        {
            return BadRequest(new
            {
                message = "Invalid cart item ID."
            });
        }

        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        try
        {
            var cart = await _cartRepository
                .UpdateItemQuantityAsync(
                    userId.Value,
                    cartItemId,
                    request.Quantity);

            if (cart is null)
            {
                return NotFound(new
                {
                    message = "Cart item not found."
                });
            }

            return Ok(cart);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // DELETE: api/Cart/items/{cartItemId}
    [HttpDelete("items/{cartItemId:int}")]
    public async Task<IActionResult> RemoveItem(
        int cartItemId)
    {
        if (cartItemId <= 0)
        {
            return BadRequest(new
            {
                message = "Invalid cart item ID."
            });
        }

        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        bool removed = await _cartRepository.RemoveItemAsync(
            userId.Value,
            cartItemId);

        if (!removed)
        {
            return NotFound(new
            {
                message = "Cart item not found."
            });
        }

        return NoContent();
    }

    // DELETE: api/Cart
    [HttpDelete]
    public async Task<IActionResult> ClearCart()
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        await _cartRepository.ClearCartAsync(userId.Value);

        return NoContent();
    }

    // POST: api/Cart/checkout
    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout(
        [FromBody] CheckoutRequest request)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        try
        {
            var order = await _orderRepository.CheckoutAsync(
                userId.Value,
                request);

            return StatusCode(
                StatusCodes.Status201Created,
                order);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new
            {
                message = ex.Message
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                message = ex.Message
            });
        }
    }
}
