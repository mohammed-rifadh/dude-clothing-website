
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models.Cart;

public class AddCartItemRequest
{
    [Range(1, int.MaxValue)]
    public int VariantId { get; set; }

    [Range(1, 100)]
    public int Quantity { get; set; }
}
