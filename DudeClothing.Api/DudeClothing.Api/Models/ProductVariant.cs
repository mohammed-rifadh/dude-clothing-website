
namespace DudeClothing.Api.Models;

public sealed class ProductVariant
{
    public int VariantId { get; set; }

    public int ProductId { get; set; }

    public string ProductName { get; set; } = string.Empty;

    public string SKU { get; set; } = string.Empty;

    public string Size { get; set; } = string.Empty;

    public string Colour { get; set; } = string.Empty;

    public int StockQuantity { get; set; }

    public bool IsActive { get; set; }
}
