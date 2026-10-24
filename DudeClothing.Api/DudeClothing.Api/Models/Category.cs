
namespace DudeClothing.Api.Models;

public sealed class Category
{
    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; }
}
