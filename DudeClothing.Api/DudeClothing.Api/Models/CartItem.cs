
namespace DudeClothing.Api.Models;

public class CartItem
{
    public int CartItemId { get; set; }

    public int CartId { get; set; }

    public int VariantId { get; set; }

    public int ProductId { get; set; }

    public string ProductName { get; set; } = string.Empty;

    public string SKU { get; set; } = string.Empty;

    public string Size { get; set; } = string.Empty;

    public string Colour { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; }

    public decimal LineTotal => UnitPrice * Quantity;

    public int StockQuantity { get; set; }

    public string? ImageUrl { get; set; }

    public DateTime AddedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
