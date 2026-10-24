
namespace DudeClothing.Api.Models;

public sealed class Product
{
    public int ProductId { get; set; }

    public string ProductName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public decimal Price { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public int StockQuantity { get; set; }

    public bool IsActive { get; set; }
}
