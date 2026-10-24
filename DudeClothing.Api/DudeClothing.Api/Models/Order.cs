
namespace DudeClothing.Api.Models;

public class Order
{
    public int OrderId { get; set; }

    public int UserId { get; set; }

    public string OrderNumber { get; set; } = string.Empty;

    public string OrderStatus { get; set; } = "Pending";

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string AddressLine1 { get; set; } = string.Empty;

    public string? AddressLine2 { get; set; }

    public string City { get; set; } = string.Empty;

    public string? PostalCode { get; set; }

    public string Country { get; set; } = string.Empty;

    public decimal Subtotal { get; set; }

    public decimal ShippingCost { get; set; }

    public decimal TotalAmount { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public List<OrderItem> Items { get; set; } = new();
}
