namespace DudeClothing.Api.Models;

public sealed class ProductImage
{
    public int ImageId { get; set; }

    public int ProductId { get; set; }

    public string ProductName { get; set; } = string.Empty;

    public string ImageUrl { get; set; } = string.Empty;

    public string? AltText { get; set; }

    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }
}